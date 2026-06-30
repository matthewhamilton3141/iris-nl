# bench — inference benchmark for iris-nl

Measures **tokens/sec, time-to-first-token, total latency, and peak VRAM** so the stage-2
optimization story has real before/after numbers. One harness, two backends:

- `hf` — Hugging Face / PyTorch. Your **baseline**.
- `trtllm` — a TensorRT-LLM engine. Your **optimized** run.

Run on the GPU machine (the 1660 Super / 3060 box), not the Mac.

## Setup (baseline)
```bash
# 1) Install PyTorch + CUDA per https://pytorch.org/get-started/locally/  (NOT plain `pip install torch`)
# 2) Then:
pip install -r requirements.txt
```

## Measure the baseline
```bash
python benchmark.py \
  --backend hf \
  --model nvidia/Nemotron-Mini-4B-Instruct \
  --out baseline.json
```

## Measure the optimized engine
After you've built a TensorRT-LLM engine (see `../../building-plans/iris-nl-stage2-tensorrt.md`):
```bash
python benchmark.py \
  --backend trtllm \
  --model ./trt_engine \
  --out tensorrt.json
```

## Read the result
```bash
python compare.py baseline.json tensorrt.json
```
Prints the speedup (×), latency drop, and VRAM change — that's your resume line.

## Notes
- Prompts default to iris-nl's `../test/fixtures.json` (so the benchmark mirrors real use).
  Override with `--prompts your_prompts.json`.
- Greedy decoding (`do_sample=False`) keeps runs deterministic and the comparison fair.
- Each prompt runs `--repeats` times and the fastest is kept, to cut noise. `--warmup` runs
  are discarded first.
- TTFT is reported for the `hf` backend; the high-level TensorRT-LLM API used here is batch-style,
  so for it we rely on tokens/sec + total latency (TTFT shows as null).
- VRAM comes from `torch`. For a pure TensorRT-LLM run where torch isn't in the loop, also eyeball
  `nvidia-smi` for the real peak.
- **Untested on GPU hardware as written** — expect to adjust for your exact torch / TRT-LLM versions.
