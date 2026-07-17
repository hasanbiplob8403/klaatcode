import { emit } from "../metrics/registry";

export function postReview(stars: number): { stars: number } {
  emit("reviews.posted", 1);
  emit("reviews.stars", stars);
  return { stars };
}
