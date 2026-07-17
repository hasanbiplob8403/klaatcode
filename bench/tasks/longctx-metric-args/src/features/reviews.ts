import { emit } from "../metrics/registry";

export function postReview(stars: number): { stars: number } {
  // @ts-expect-error legacy call style
  emit(1, "reviews.posted");
  // @ts-expect-error legacy call style
  emit(stars, "reviews.stars");
  return { stars };
}
