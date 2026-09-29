# Capstone — Baseline vs Proposed

Workload: first 200 rows of the smartwear CSV (23 flagged = 11.5%)

| metric             | baseline (forward-all) | proposed (edge placement) | improvement |
| ------------------ | ---------------------- | ------------------------- | ----------- |
| device sent        | 172                    | 209                       | —           |
| device err         | 0                      | 0                         | none        |
| Core processed     | 253                    | 29                        | -88.5%      |
| device avgLatency  | 60.65 ms               | 10.54 ms                  | 5.8× faster |
| device p50         | 54 ms                  | 7 ms                      | 7.7× faster |
| device p95         | 88 ms                  | 56 ms                     | 1.6× faster |
| device p99         | 259 ms                 | 66 ms                     | 3.9× faster |
| device max         | 936 ms                 | 81 ms                     | 11.5×       |

Key takeaways:
- Edge placement eliminates 88.5% of Core load by handling NORMAL records locally.
- Latency drops 5–8× on median/average, 4× on p99.
- Zero availability loss — err=0 in both modes.
- The mechanism: lightTask() flags 11.5% of records; placementScore() routes only those
  that are both flagged and where Core is healthy enough to justify the round trip.
