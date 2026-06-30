#!/usr/bin/env python3
"""
Hardware-agnostic inference benchmark for the iris-nl stage-2 optimization story.

It measures, for a fixed prompt set:
  - tokens/sec (throughput)
  - time-to-first-token (TTFT, ms)   [HF backend only; see note on TRT-LLM]
  - total latency per request (ms)
  - peak VRAM (MB)

The backend is pluggable (mirroring iris-nl's Provider pattern) so the SAME harness
benchmarks the BASELINE (Hugging Face / PyTorch) and the OPTIMIZED engine (TensorRT-LLM).
Run once per backend, then diff the two JSON files to get your before/after numbers.

Examples:
  # Baseline, full precision, on the GPU
  python benchmark.py --backend hf --model nvidia/Nemotron-Mini-4B-Instruct --out baseline.json

  # Optimized engine you built with TensorRT-LLM
  python benchmark.py --backend trtllm --model ./trt_engine --out tensorrt.json

Notes:
  - Heavy deps (torch/transformers/tensorrt_llm) are imported lazily inside each backend,
    so `--help` works on any machine (including the Mac that wrote this).
  - Not yet executed on real GPU hardware — treat versions/APIs as a starting point and
    expect to tweak for your exact torch / TensorRT-LLM build.
"""
from __future__ import annotations

import argparse
import json
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol


# --- The result of generating a completion for one prompt ---------------------
class GenResult(dict):
    """{ttft_ms: float|None, total_ms: float, output_tokens: int, text: str}"""


class Backend(Protocol):
    name: str

    def generate(self, prompt: str, max_new_tokens: int) -> GenResult: ...


# --- Baseline backend: Hugging Face / PyTorch ---------------------------------
class HFBackend:
    name = "hf"

    def __init__(self, model_id: str, dtype: str = "float16", device: str = "cuda"):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.device = device
        torch_dtype = getattr(torch, dtype)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, torch_dtype=torch_dtype, device_map=device
        ).eval()

    def _encode(self, prompt: str):
        messages = [{"role": "user", "content": prompt}]
        return self.tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt"
        ).to(self.device)

    def generate(self, prompt: str, max_new_tokens: int) -> GenResult:
        import threading

        from transformers import TextIteratorStreamer

        input_ids = self._encode(prompt)
        streamer = TextIteratorStreamer(
            self.tokenizer, skip_prompt=True, skip_special_tokens=True
        )
        gen_kwargs = dict(
            input_ids=input_ids,
            max_new_tokens=max_new_tokens,
            do_sample=False,  # greedy -> deterministic, fair to compare
            streamer=streamer,
        )

        start = time.perf_counter()
        thread = threading.Thread(target=self.model.generate, kwargs=gen_kwargs)
        thread.start()

        ttft_ms = None
        text = ""
        for chunk in streamer:
            if ttft_ms is None:
                ttft_ms = (time.perf_counter() - start) * 1000
            text += chunk
        thread.join()
        total_ms = (time.perf_counter() - start) * 1000

        # Count real tokens by re-encoding the generated text (streamer yields strings).
        output_tokens = len(self.tokenizer.encode(text))
        return GenResult(
            ttft_ms=ttft_ms, total_ms=total_ms, output_tokens=output_tokens, text=text
        )


# --- Optimized backend: TensorRT-LLM ------------------------------------------
class TRTLLMBackend:
    name = "trtllm"

    def __init__(self, model_path: str):
        from tensorrt_llm import LLM, SamplingParams

        self._SamplingParams = SamplingParams
        self.llm = LLM(model=model_path)

    def generate(self, prompt: str, max_new_tokens: int) -> GenResult:
        sampling = self._SamplingParams(max_tokens=max_new_tokens, temperature=0.0)
        start = time.perf_counter()
        outputs = self.llm.generate([prompt], sampling)
        total_ms = (time.perf_counter() - start) * 1000

        out = outputs[0].outputs[0]
        # TTFT needs the streaming/async API; the high-level generate() is batch-style,
        # so we report None here and rely on tokens/sec + total latency for the comparison.
        return GenResult(
            ttft_ms=None,
            total_ms=total_ms,
            output_tokens=len(out.token_ids),
            text=out.text,
        )


def build_backend(args) -> Backend:
    if args.backend == "hf":
        return HFBackend(args.model, dtype=args.dtype, device=args.device)
    if args.backend == "trtllm":
        return TRTLLMBackend(args.model)
    raise ValueError(f"unknown backend: {args.backend}")


# --- Prompt loading -----------------------------------------------------------
def load_prompts(path: Path) -> list[str]:
    """Accepts either iris-nl's test/fixtures.json ([{query: ...}]) or a plain [str]."""
    data = json.loads(path.read_text())
    prompts: list[str] = []
    for item in data:
        if isinstance(item, str):
            prompts.append(item)
        elif isinstance(item, dict) and "query" in item:
            prompts.append(item["query"])
    if not prompts:
        raise ValueError(f"no prompts found in {path}")
    return prompts


# --- VRAM helpers -------------------------------------------------------------
def reset_peak_vram() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
    except Exception:
        pass


def read_peak_vram_mb() -> float | None:
    try:
        import torch

        if torch.cuda.is_available():
            return torch.cuda.max_memory_allocated() / (1024 * 1024)
    except Exception:
        pass
    return None  # torch absent (e.g. pure TRT-LLM C++): eyeball `nvidia-smi` instead


def gpu_name() -> str | None:
    try:
        import torch

        if torch.cuda.is_available():
            return torch.cuda.get_device_name(0)
    except Exception:
        pass
    return None


# --- Main loop ----------------------------------------------------------------
def run(args) -> dict:
    prompts = load_prompts(Path(args.prompts))
    backend = build_backend(args)

    # Warm up on the first prompt so caches/JIT don't pollute the first measurement.
    for _ in range(args.warmup):
        backend.generate(prompts[0], args.max_new_tokens)

    reset_peak_vram()
    per_prompt = []
    for prompt in prompts:
        best = None  # keep the fastest of N repeats to reduce noise
        for _ in range(args.repeats):
            r = backend.generate(prompt, args.max_new_tokens)
            tok_per_sec = r["output_tokens"] / (r["total_ms"] / 1000) if r["total_ms"] else 0.0
            sample = {
                "prompt": prompt,
                "ttft_ms": r["ttft_ms"],
                "total_ms": r["total_ms"],
                "output_tokens": r["output_tokens"],
                "tokens_per_sec": tok_per_sec,
            }
            if best is None or sample["tokens_per_sec"] > best["tokens_per_sec"]:
                best = sample
        per_prompt.append(best)

    def mean(key: str) -> float | None:
        vals = [p[key] for p in per_prompt if p[key] is not None]
        return statistics.fmean(vals) if vals else None

    return {
        "meta": {
            "backend": backend.name,
            "model": args.model,
            "gpu": gpu_name(),
            "dtype": args.dtype if args.backend == "hf" else "engine",
            "max_new_tokens": args.max_new_tokens,
            "warmup": args.warmup,
            "repeats": args.repeats,
            "prompts": len(prompts),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "summary": {
            "mean_tokens_per_sec": mean("tokens_per_sec"),
            "mean_ttft_ms": mean("ttft_ms"),
            "mean_total_ms": mean("total_ms"),
            "peak_vram_mb": read_peak_vram_mb(),
        },
        "per_prompt": per_prompt,
    }


def parse_args():
    here = Path(__file__).resolve().parent
    default_prompts = here.parent / "test" / "fixtures.json"

    p = argparse.ArgumentParser(description="iris-nl inference benchmark")
    p.add_argument("--backend", choices=["hf", "trtllm"], required=True)
    p.add_argument("--model", required=True, help="HF model id, or path to a TRT-LLM engine")
    p.add_argument("--out", required=True, help="where to write the results JSON")
    p.add_argument("--prompts", default=str(default_prompts), help="JSON list of prompts")
    p.add_argument("--max-new-tokens", type=int, default=64)
    p.add_argument("--dtype", default="float16", help="HF backend dtype, e.g. float16/bfloat16")
    p.add_argument("--device", default="cuda")
    p.add_argument("--warmup", type=int, default=1)
    p.add_argument("--repeats", type=int, default=3, help="runs per prompt; fastest is kept")
    return p.parse_args()


def main():
    args = parse_args()
    results = run(args)
    Path(args.out).write_text(json.dumps(results, indent=2))

    s = results["summary"]
    print(f"\nBackend: {results['meta']['backend']}  Model: {results['meta']['model']}")
    print(f"GPU: {results['meta']['gpu']}")
    print(f"  tokens/sec : {s['mean_tokens_per_sec']}")
    print(f"  TTFT (ms)  : {s['mean_ttft_ms']}")
    print(f"  total (ms) : {s['mean_total_ms']}")
    print(f"  peak VRAM  : {s['peak_vram_mb']} MB")
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
