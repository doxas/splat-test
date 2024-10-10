
export async function loadFile(path: string): Promise<string> {
  const response = await fetch(path);
  const text = await response.text();
  return text;
}

export async function loadJson(path: string): Promise<any> {
  const text = await loadFile(path);
  return JSON.parse(text);
}
