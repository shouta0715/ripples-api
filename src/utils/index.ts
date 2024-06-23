const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkUUID(id: string | undefined): boolean {
  if (!id) return false;

  return uuidRegex.test(id);
}

export const getRandomInitialPosition = () => {
  const x = Math.floor(Math.random() * 100);
  const y = Math.floor(Math.random() * 100);

  return { x, y };
};
