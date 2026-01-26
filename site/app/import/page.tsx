import { ImportClient } from "./ImportClient";

import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export default async function ImportPage() {
  const [categories, index] = await Promise.all([loadRegistryCategories(), loadRegistryIndex()]);
  return <ImportClient initialCategories={categories} initialRegistryIndex={index} />;
}

