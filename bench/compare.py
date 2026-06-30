#!/usr/bin/env python3
"""
Diff two benchmark.py result files (baseline vs optimized) into a one-line story.

  python compare.py baseline.json tensorrt.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def load(path: str) -> dict:
    return json.loads(Path(path).read_text())


def ratio(new: float | None, old: float | None) -> str:
    if not new or not old:
        return "n/a"
    return f"{new / old:.2f}x"


def main():
    if len(sys.argv) != 3:
        print("usage: python compare.py <baseline.json> <optimized.json>")
        sys.exit(2)

    base, opt = load(sys.argv[1]), load(sys.argv[2])
    b, o = base["summary"], opt["summary"]
    gpu = opt["meta"].get("gpu") or base["meta"].get("gpu") or "GPU"
    model = opt["meta"].get("model") or base["meta"].get("model")

    def line(label: str, bv, ov, unit: str, word: str = "throughput", lower_is_better: bool = False):
        if bv is None or ov is None:
            print(f"  {label:<14} {bv} -> {ov} {unit}")
            return
        change = (bv / ov) if lower_is_better else (ov / bv)
        print(f"  {label:<14} {bv:.1f} -> {ov:.1f} {unit}   ({change:.2f}x {word})")

    print(f"\n{model} on {gpu}")
    print(f"  {base['meta']['backend']}  ->  {opt['meta']['backend']}\n")
    line("tokens/sec", b["mean_tokens_per_sec"], o["mean_tokens_per_sec"], "tok/s", "throughput")
    line("total latency", b["mean_total_ms"], o["mean_total_ms"], "ms", "faster", lower_is_better=True)
    line("peak VRAM", b["peak_vram_mb"], o["peak_vram_mb"], "MB", "less", lower_is_better=True)

    speedup = ratio(o["mean_tokens_per_sec"], b["mean_tokens_per_sec"])
    print(
        f"\nResume line: \"{model} on {gpu}: "
        f"{b['mean_tokens_per_sec']:.0f} -> {o['mean_tokens_per_sec']:.0f} tok/s "
        f"({speedup}) via TensorRT-LLM.\""
    )


if __name__ == "__main__":
    main()
