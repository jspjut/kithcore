// The same definition bytes are read by Node and the browser.
export async function readDefinition(url) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load world data: ${response.status}`);
  return response.json();
}
