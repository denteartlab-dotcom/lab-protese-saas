import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const projectRoot = path.resolve(__dirname);

const webpackWatchIgnoredGlobs = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/System Volume Information/**",
  "**/hiberfil.sys",
  "**/swapfile.sys",
  "**/pagefile.sys",
];

function resolveAppBuildId() {
  if (process.env.NODE_ENV === "development") {
    return "dev";
  }
  const doArquivo = (() => {
    try {
      const valor = readFileSync(path.join(projectRoot, ".build-id"), "utf8").trim();
      return valor.length >= 6 ? valor : "";
    } catch {
      return "";
    }
  })();
  if (doArquivo) return doArquivo;
  const deEnv = process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim();
  if (deEnv && deEnv.length >= 6) {
    return deEnv;
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    return process.env.VERCEL_GIT_COMMIT_SHA.trim().slice(0, 12);
  }
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim().slice(0, 12);
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return String(Date.now());
  }
}

const appBuildId = resolveAppBuildId();

function resolveAssetPrefix() {
  // Assets relativos (/_next/static) — evita JS/CSS apontando para beta após deploy em www.
  return undefined;
}

const assetPrefix = resolveAssetPrefix();

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  /** Evita bundling de libs Node (unzipper puxa @aws-sdk/client-s3 opcional). */
  serverExternalPackages: ["archiver", "unzipper"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1",
  },
  ...(assetPrefix ? { assetPrefix } : {}),
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: appBuildId,
  },
  async headers() {
    // unsafe-eval só em dev (HMR/Next). Em produção: sem eval; inline ainda necessário
    // para Next sem nonces e Cloudflare Insights.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      // PDF da OS/fatura em iframe (blob:) — sem isso o Chrome bloqueia o visualizador
      "frame-src 'self' blob: data:",
      "child-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "object-src 'self' blob: data:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      { key: "Content-Security-Policy", value: csp },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains; preload",
            },
          ]
        : []),
    ];

    return [
      {
        source: "/images/asaas-selo-oficial-positivo.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/images/asaas-selo-oficial-negativo.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "no-store",
          },
          ...securityHeaders,
        ],
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
  webpack: (config, { dev, webpack }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@aws-sdk\/client-s3$/,
      })
    );
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        followSymlinks: false,
        ignored: webpackWatchIgnoredGlobs,
        ...(process.platform === "win32"
          ? { poll: 2000, aggregateTimeout: 500 }
          : {}),
      };
    }
    return config;
  },
};

export default nextConfig;
