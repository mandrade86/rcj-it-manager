export class ApiRequestError extends Error {
  field?: string
  status?: number

  constructor(message: string, field?: string, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.field = field
    this.status = status
  }
}

export async function readApiError(res: Response): Promise<ApiRequestError> {
  try {
    const j = (await res.json()) as { error?: string; field?: string }
    return new ApiRequestError(j.error ?? res.statusText, j.field, res.status)
  } catch {
    return new ApiRequestError(res.statusText, undefined, res.status)
  }
}

export function isApiRequestError(ex: unknown): ex is ApiRequestError {
  return ex instanceof ApiRequestError
}
