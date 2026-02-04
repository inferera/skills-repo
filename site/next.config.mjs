/** @type {import('next').NextConfig} */
const rawBasePath = process.env.SITE_BASE_PATH ?? "";
const basePathValue = rawBasePath === "ROOT" ? "" : rawBasePath.replace(/^\/+/, "");

const nextConfig = {
  trailingSlash: true,
  // GitHub Pages project sites need a basePath like "/repo-name".
  // On Vercel, leave SITE_BASE_PATH empty or unset.
  basePath: basePathValue ? `/${basePathValue}` : "",
  assetPrefix: basePathValue ? `/${basePathValue}` : ""
};

export default nextConfig;
