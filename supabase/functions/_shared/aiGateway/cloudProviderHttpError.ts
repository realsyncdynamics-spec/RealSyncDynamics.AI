// Keep the status separate from the provider's optional error text.
export class CloudProviderHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CloudProviderHttpError';
  }

  static async fromResponse(provider: string, response: Response): Promise<CloudProviderHttpError> {
    let message = `${provider} HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: { message?: unknown } };
      if (typeof body?.error?.message === 'string') message = body.error.message;
    } catch {
      // Preserve the status if the provider returns a non-JSON error page.
    }
    return new CloudProviderHttpError(response.status, message);
  }
}
