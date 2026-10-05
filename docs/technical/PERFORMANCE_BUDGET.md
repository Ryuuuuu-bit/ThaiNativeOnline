# Performance Budget

Performance targets are provisional and must be measured on real scenes.

Rules:
- reuse geometry/materials
- prefer instancing for repeated props/vegetation
- use LOD for major environment assets
- control transparent foliage overdraw
- avoid unnecessary per-frame allocations
- profile before optimizing
- validate visual changes at target gameplay camera

Technical Artist must reject visually minor features with disproportionate runtime cost.
