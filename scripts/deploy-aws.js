// Publishes the built site in dist/ to one environment's S3 bucket and CloudFront distribution.
// Run by the Deploy workflow after `npm run build`, with AWS credentials from GitHub's OIDC role:
//
//   S3_BUCKET=... CLOUDFRONT_DISTRIBUTION_ID=... node scripts/deploy-aws.js
//
// Order matters, so visitors never get a page whose inlined styles the CSP header blocks:
//   1. Upload everything except the pages. Fingerprinted files in /static are never deleted, so
//      pages still cached in a browser (or an older release rolled back to) keep working.
//   2. If the CSP changed, widen the header to allow both the old and new hashes, and wait for
//      CloudFront to roll that out.
//   3. Upload the pages, invalidate the cache and wait for the invalidation.
//   4. Narrow the CSP header to exactly the new policy, then remove files the build no longer has.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, extname } from 'node:path';

const bucket = process.env.S3_BUCKET;
const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
if (!bucket || !distributionId) {
    console.error('Set S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID.');
    process.exit(1);
}
const dist = 'dist';
const cspFile = 'infra/content-security-policy.txt';
const scratch = mkdtempSync(join(tmpdir(), 'deploy-'));

const aws = (...args) => execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const awsJson = (...args) => JSON.parse(aws(...args, '--output', 'json'));

// Explicit types: the AWS CLI guesses from the runner's mime.types, which lacks some of these.
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff2': 'font/woff2',
};
const cacheControl = (key) => {
    if (key.startsWith('static/')) return 'public, max-age=31536000, immutable';
    if (key.startsWith('assets/') || key.startsWith('js/')) return 'public, max-age=86400, stale-while-revalidate=604800';
    return 'public, max-age=0, must-revalidate';
};

const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const keys = walk(dist).map((f) => relative(dist, f).split('\\').join('/'));

function upload(selected) {
    // One `aws s3 cp` per (type, cache) pair instead of one per file.
    const groups = new Map();
    for (const key of selected) {
        const type = types[extname(key).toLowerCase()];
        if (!type) throw new Error(`No content type for ${key}; add its extension to scripts/deploy-aws.js`);
        const id = `${type}\n${cacheControl(key)}`;
        groups.set(id, [...(groups.get(id) ?? []), key]);
    }
    for (const [id, group] of groups) {
        const [type, cache] = id.split('\n');
        const includes = group.flatMap((key) => ['--include', key]);
        aws(
            's3',
            'cp',
            dist,
            `s3://${bucket}`,
            '--recursive',
            '--only-show-errors',
            '--exclude',
            '*',
            ...includes,
            '--content-type',
            type,
            '--cache-control',
            cache,
        );
        console.log(`Uploaded ${group.length} file(s) as ${type} (${cache})`);
    }
}

// CSP helpers: "a b c; d e" <-> Map(a => [b, c], d => [e])
const parseCsp = (text) =>
    new Map(
        text
            .split(';')
            .map((d) => d.trim().split(/\s+/))
            .filter((d) => d[0])
            .map(([name, ...values]) => [name, values]),
    );
const cspText = (map) => [...map].map(([name, values]) => [name, ...values].join(' ')).join('; ');
const unionCsp = (a, b) => {
    const merged = parseCsp(a);
    for (const [name, values] of parseCsp(b)) merged.set(name, [...new Set([...(merged.get(name) ?? []), ...values])]);
    return cspText(merged);
};

const policyId = aws(
    'cloudfront',
    'get-distribution-config',
    '--id',
    distributionId,
    '--query',
    'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId',
    '--output',
    'text',
).trim();
function setCsp(value) {
    const current = awsJson('cloudfront', 'get-response-headers-policy', '--id', policyId);
    const config = current.ResponseHeadersPolicy.ResponseHeadersPolicyConfig;
    if (config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy === value) return false;
    config.SecurityHeadersConfig.ContentSecurityPolicy = { ContentSecurityPolicy: value, Override: true };
    const file = join(scratch, 'headers-policy.json');
    writeFileSync(file, JSON.stringify(config));
    aws(
        'cloudfront',
        'update-response-headers-policy',
        '--id',
        policyId,
        '--if-match',
        current.ETag,
        '--response-headers-policy-config',
        `file://${file}`,
    );
    return true;
}
const currentCsp = () =>
    awsJson('cloudfront', 'get-response-headers-policy', '--id', policyId).ResponseHeadersPolicy.ResponseHeadersPolicyConfig
        .SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;

const pages = keys.filter((k) => k.endsWith('.html'));
const others = keys.filter((k) => !k.endsWith('.html'));
const newCsp = readFileSync(cspFile, 'utf8').trim();

// 1. Files first, fingerprinted ones before the rest.
upload(others.filter((k) => k.startsWith('static/')));
upload(others.filter((k) => !k.startsWith('static/')));

// 2. A CSP that allows both the pages being replaced and the new ones.
const oldCsp = currentCsp();
if (oldCsp !== newCsp) {
    setCsp(unionCsp(oldCsp, newCsp));
    console.log('Content-Security-Policy changed; allowing old and new hashes while the pages switch over...');
    aws('cloudfront', 'wait', 'distribution-deployed', '--id', distributionId);
}

// 3. The pages, then a cache invalidation so every edge serves them right away.
upload(pages);
const invalidation = awsJson('cloudfront', 'create-invalidation', '--distribution-id', distributionId, '--paths', '/*').Invalidation.Id;
console.log(`Invalidating the CloudFront cache (${invalidation})...`);
aws('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', distributionId, '--id', invalidation);

// 4. Exactly the new policy, and no leftovers outside /static.
if (setCsp(newCsp)) console.log('Content-Security-Policy header updated.');
const live = new Set(keys);
const stale = awsJson('s3api', 'list-objects-v2', '--bucket', bucket, '--query', 'Contents[].Key')?.filter(
    (key) => !key.startsWith('static/') && !live.has(key),
);
for (const key of stale ?? []) {
    aws('s3', 'rm', `s3://${bucket}/${key}`, '--only-show-errors');
    console.log(`Removed ${key}`);
}
console.log(`Deployed ${keys.length} files to s3://${bucket} behind ${distributionId}.`);
