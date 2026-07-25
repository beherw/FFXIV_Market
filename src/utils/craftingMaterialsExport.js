/**
 * Collect the final materials from a crafting tree. Only leaf nodes are
 * included: these are the items a player still needs to obtain after crafting
 * every available intermediate recipe.
 */
export function collectLeafMaterials(tree, scale = 1) {
  const materials = new Map();

  const visit = (node, multiplier) => {
    if (!node) return;
    const amount = (Number(node.amount) || 0) * multiplier;
    const children = node.children || [];

    if (children.length === 0) {
      materials.set(node.itemId, (materials.get(node.itemId) || 0) + amount);
      return;
    }

    children.forEach((child) => visit(child, multiplier));
  };

  visit(tree, scale);
  return materials;
}

/**
 * Collect every material node in a crafting tree, including craftable
 * intermediates. The synthetic combined root and separately listed outputs are
 * intentionally excluded.
 */
export function collectAllTreeMaterials(tree, scale = 1) {
  const materials = new Map();

  const visit = (node, multiplier, isRoot = false) => {
    if (!node) return;

    if (!isRoot && node.itemId !== undefined && node.itemId !== null) {
      const amount = (Number(node.amount) || 0) * multiplier;
      materials.set(node.itemId, (materials.get(node.itemId) || 0) + amount);
    }

    (node.children || []).forEach((child) => visit(child, multiplier));
  };

  visit(tree, scale, true);
  return materials;
}

function escapeCsvValue(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function formatMaterialsCsv({ materials, itemNames, outputs = [] }) {
  const outputRows = outputs
    .filter((output) => output?.itemId)
    .map((output) => ['成品', itemNames[output.itemId] || `物品 ${output.itemId}`, output.amount]);
  const materialRows = [...materials.entries()]
    .map(([itemId, amount]) => ({ itemId, amount, name: itemNames[itemId] || `物品 ${itemId}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
    .map(({ name, amount }) => ['材料', name, amount]);

  return [
    ['類型', '物品名稱', '數量'],
    ...outputRows,
    ...materialRows,
  ].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

export function downloadMaterialsCsv(csv, filename) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
