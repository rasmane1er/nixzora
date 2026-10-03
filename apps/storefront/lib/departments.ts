import { departmentArtPath } from '@nixzora/validation';

/** A picture for each department tile on the home page, from the demo catalog's artwork. */
export function departmentImage(slug: string): string | null {
  return departmentArtPath(slug);
}
