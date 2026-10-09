"""Crocodilian geodesic weights; UV copies share normalized influences.

This pure authoring calculation does not modify Blender. Registered rig
commands apply the result, and final compressed geometry receives motion QA.
"""
import collections
import heapq
import math


def croc_weights(points, indices, bones, legs):
    keys = [tuple(round(v, 5) for v in p) for p in points]
    unique = list(dict.fromkeys(keys))
    lookup = {p: i for i, p in enumerate(unique)}
    remap = [lookup[p] for p in keys]
    graph = [{} for _ in unique]
    for i in range(0, len(indices), 3):
        tri = [remap[v] for v in indices[i:i + 3]]
        for a, b in zip(tri, tri[1:] + tri[:1]):
            if a != b:
                graph[a][b] = graph[b][a] = math.dist(unique[a], unique[b])
    deform = [b for b in bones if b['deform']]

    def distance(p, b):
        a = b['head']
        d = [v - u for u, v in zip(a, b['tail'])]
        t = max(0, min(1, sum((v - u) * w for v, u, w in zip(p, a, d)) / sum(w * w for w in d)))
        return math.sqrt(sum((v - u - t * w) ** 2 for v, u, w in zip(p, a, d)))

    seeds = [{} for _ in deform]
    for bi, b in enumerate(deform):
        for fraction in [0, .25, .5, .75, 1]:
            sample = [a + (z - a) * fraction for a, z in zip(b['head'], b['tail'])]
            for vi in sorted(range(len(unique)), key=lambda i: math.dist(unique[i], sample))[:3]:
                seeds[bi][vi] = min(seeds[bi].get(vi, math.inf), distance(unique[vi], b))
    visited = set()
    for vi in range(len(unique)):
        if vi in visited:
            continue
        stack, component = [vi], []
        while stack:
            a = stack.pop()
            if a in visited:
                continue
            visited.add(a)
            component.append(a)
            stack.extend(n for n in graph[a] if n not in visited)
        if not any(any(i in seed for i in component) for seed in seeds):
            length, bi, a = min((distance(unique[i], b), bi, i) for bi, b in enumerate(deform) for i in component)
            seeds[bi][a] = length
    distances = []
    for seed in seeds:
        d, queue = [math.inf] * len(unique), []
        for vi, length in seed.items():
            d[vi] = length
            heapq.heappush(queue, (length, vi))
        while queue:
            length, a = heapq.heappop(queue)
            if length != d[a]:
                continue
            for b, edge in graph[a].items():
                nd = length + edge
                if nd < d[b]:
                    d[b] = nd
                    heapq.heappush(queue, (nd, b))
        distances.append(d)
    values = [{min(range(len(deform)), key=lambda bi: distances[bi][vi]): 1.0} for vi in range(len(unique))]
    for _ in range(80):
        smoothed = []
        for vi, weight in enumerate(values):
            if not graph[vi]:
                smoothed.append(weight)
                continue
            average = collections.defaultdict(float)
            for n in graph[vi]:
                for bi, v in values[n].items():
                    average[bi] += v / len(graph[vi])
            smoothed.append({bi: weight.get(bi, 0) * .65 + average.get(bi, 0) * .35 for bi in weight.keys() | average.keys()})
        values = smoothed
    result = []
    for vi, weight in enumerate(values):
        # The low torso can be geodesically closer to several upper legs than
        # to the internal spine. Keep its central belly/dorsal surface with
        # Body and blend only across real shoulder/hip attachments.
        x, y, _ = unique[vi]
        def smooth(a, b, value):
            t = max(0, min(1, (value - a) / (b - a)))
            return t * t * (3 - 2 * t)
        torso = (1 - smooth(.11, .19, abs(x))) * smooth(-.60, -.51, y) * (1 - smooth(-.10, .025, y))
        body_index = next(i for i, b in enumerate(deform) if b['name'] == 'Body')
        weight = {bi: v * (1 - torso) for bi, v in weight.items()}
        weight[body_index] = weight.get(body_index, 0) + torso
        # The whole heel/toe sole belongs to its foot. Geodesic blending alone
        # leaves low heel vertices with lower-leg weights; those sink during
        # a planted step even though the Foot control itself stays on plane.
        foot_indices = [i for i, b in enumerate(deform) if b['name'].endswith('Foot')]
        nearest_foot = min(foot_indices, key=lambda i: distance(unique[vi], deform[i]))
        proximity = distance(unique[vi], deform[nearest_foot])
        sole = (1 - smooth(.045, .085, unique[vi][2])) * (1 - smooth(.12, .16, proximity)) * smooth(.17, .20, abs(x))
        weight = {bi: v * (1 - sole) for bi, v in weight.items()}
        weight[nearest_foot] = weight.get(nearest_foot, 0) + sole
        selected = sorted(weight.items(), key=lambda item: -item[1])[:4]
        total = sum(v for _, v in selected)
        counts = {deform[bi]['name']: round(v / total * 64) for bi, v in selected if v / total > .01}
        counts = {b: v for b, v in counts.items() if v}
        counts[max(counts, key=counts.get)] += 64 - sum(counts.values())
        result.append({b: v / 64 for b, v in counts.items()})
    return [result[i] for i in remap]
