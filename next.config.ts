import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  // Stop next dev rewriting AGENTS.md — that churn stalls Turbopack reloads.
  agentRules: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  onDemandEntries: {
    maxInactiveAge: 60_000,
    pagesBufferLength: 4,
  },
};

export default config;
