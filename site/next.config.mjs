/** @type {import('next').NextConfig} */
const rawBasePath = process.env.SITE_BASE_PATH ?? "";
const basePathValue = rawBasePath === "ROOT" ? "" : rawBasePath.replace(/^\/+/, "");

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // GitHub Pages project sites need a basePath like "/repo-name".
  basePath: basePathValue ? `/${basePathValue}` : "",
  assetPrefix: basePathValue ? `/${basePathValue}` : ""
};

export default nextConfig;
