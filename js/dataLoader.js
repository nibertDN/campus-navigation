export async function loadJson(path) {
  try {
    const response = await fetch(path);
    return await response.json();
  } catch (error) {
    console.error(`Unable to load JSON ${path}`, error);
    return [];
  }
}
