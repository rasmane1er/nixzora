import { z } from 'zod';

// In browsers, never probe for eval: under the Content Security Policy the probe is blocked
// (harmlessly) but reported as a violation. Servers keep Zod's faster compiled checks.
if ('window' in globalThis) z.config({ jitless: true });

export * from './admin';
export * from './advertising';
export * from './assistant';
export * from './auth';
export * from './catalog';
export * from './commerce';
export * from './deals';
export * from './delivery';
export * from './health';
export * from './lists';
export * from './marketplace';
export * from './mobile';
export * from './money';
export * from './operations';
export * from './pagination';
export * from './recommendations';
export * from './account';
export * from './seller-onboarding';
export * from './taxonomy';
export * from './variant-options';
export * from './gift-cards';
