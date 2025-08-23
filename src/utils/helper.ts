function isAxiosError(error: unknown): error is import('axios').AxiosError {
    return (error as any).isAxiosError !== undefined;
}