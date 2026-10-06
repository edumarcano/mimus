import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository maintains its own AGENTS.md; keep `next dev` from rewriting it.
  agentRules: false,
};

export default nextConfig;
