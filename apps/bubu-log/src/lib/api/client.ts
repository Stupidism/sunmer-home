import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "./openapi-types";
import {
  BABY_ID_HEADER_KEY,
  extractBabyIdFromPathname,
  withBabyIdOnApiPath,
} from '@/lib/baby-scope'

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

function scopeApiRequest(input: FetchInput, init?: FetchInit): { input: FetchInput; init?: FetchInit } {
  if (typeof window === 'undefined') {
    return { input, init }
  }

  const babyId = extractBabyIdFromPathname(window.location.pathname)
  if (!babyId) {
    return { input, init }
  }

  let scopedInput = input
  if (typeof input === 'string') {
    scopedInput = withBabyIdOnApiPath(input, babyId)
  } else if (input instanceof URL) {
    scopedInput = new URL(withBabyIdOnApiPath(input.toString(), babyId))
  }

  const headers = new Headers(init?.headers)
  if (!headers.has(BABY_ID_HEADER_KEY)) {
    headers.set(BABY_ID_HEADER_KEY, babyId)
  }

  return {
    input: scopedInput,
    init: {
      ...init,
      headers,
    },
  }
}

// 自定义 fetch 函数，添加 401 错误处理
const customFetch: typeof fetch = async (input, init) => {
  const scopedRequest = scopeApiRequest(input, init)
  const response = await fetch(scopedRequest.input, scopedRequest.init);
  
  // 如果返回 401，重定向到登录页（但如果已经在登录页则不重定向，避免无限循环）
  if (response.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  
  return response;
};

const fetchClient = createFetchClient<paths>({
  baseUrl: "/api/app",
  fetch: customFetch,
});

export const $api = createClient(fetchClient);
