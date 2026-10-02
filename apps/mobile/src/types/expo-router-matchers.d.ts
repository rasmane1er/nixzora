// expo-router/testing-library registers these matchers at runtime but ships no typings.
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
    toHaveSearchParams(params: Record<string, string | string[]>): R;
  }
}
