/** Complete the explicitly configured legacy OAuth popup from its registered redirect page. */
export async function completeBronAuthorization(redirectUri: string): Promise<void> {
  const { completeBronAuthorization: complete } = await import('@partylayer/adapter-bron');
  complete(redirectUri);
}
