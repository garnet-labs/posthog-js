#!/usr/bin/env node
// JSON parse/serialize micro-benchmark. Self-contained — no network egress,
// no extra runtime to install. Results are written to ./results.json so the
// workflow can pick them up as an artifact.
const { writeFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const { join } = require('node:path');

const PAYLOAD = {
  event: '$pageview',
  distinct_id: 'user_42',
  properties: {
    $current_url: 'https://example.com/dashboard',
    $referrer: 'https://example.com/',
    $browser: 'Chrome',
    $browser_version: 124,
    $os: 'Mac OS X',
    $screen_width: 2560,
    $screen_height: 1440,
    $lib: 'web',
    $lib_version: '1.250.0',
    custom_array: Array.from({ length: 32 }, (_, i) => ({ i, v: `value-${i}` })),
  },
};

const SERIALIZED = JSON.stringify(PAYLOAD);
const ITERATIONS = 5000;
const SAMPLES = 20;

function measure(fn) {
  const samples = [];
  for (let s = 0; s < SAMPLES; s++) {
    const t0 = performance.now();
    for (let i = 0; i < ITERATIONS; i++) fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const median = samples[Math.floor(samples.length / 2)];
  return { mean_ms: +mean.toFixed(4), median_ms: +median.toFixed(4), samples: samples.length, iterations: ITERATIONS };
}

const parse = measure(() => JSON.parse(SERIALIZED));
const serialize = measure(() => JSON.stringify(PAYLOAD));

const results = {
  node_version: process.version,
  platform: `${process.platform}-${process.arch}`,
  benchmarks: { json_parse: parse, json_serialize: serialize },
};

const out = join(__dirname, '..', 'results.json');
writeFileSync(out, JSON.stringify(results, null, 2));

console.log(`[perf/bench] json_parse     mean=${parse.mean_ms}ms median=${parse.median_ms}ms (${parse.samples}x${parse.iterations})`);
console.log(`[perf/bench] json_serialize mean=${serialize.mean_ms}ms median=${serialize.median_ms}ms (${serialize.samples}x${serialize.iterations})`);
console.log(`[perf/bench] wrote ${out}`);
