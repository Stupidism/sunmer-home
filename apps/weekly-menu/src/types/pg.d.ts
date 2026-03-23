declare module 'pg' {
  export class PoolClient {
    query<T = Record<string, unknown>>(
      text: string,
      params?: Array<string | number | null>,
    ): Promise<{ rows: T[]; rowCount: number | null }>
    release(): void
  }

  export class Pool {
    constructor(config?: { connectionString?: string })
    query<T = Record<string, unknown>>(
      text: string,
      params?: Array<string | number | null>,
    ): Promise<{ rows: T[]; rowCount: number | null }>
    connect(): Promise<PoolClient>
    end(): Promise<void>
  }
}
