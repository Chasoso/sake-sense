import { BODY_HYBRID_HALO_VARIANTS, type BodyHybridHaloVariant } from "./body-pose-guidance";
import {
  CONTOUR_PRESENTATION_VARIANTS,
  type ContourPresentationVariant,
} from "./segmentation-mask-spike";

export type BodyHybridComparisonVariant = {
  id: string;
  halo: BodyHybridHaloVariant;
  contour: ContourPresentationVariant;
};

export function createBodyHybridComparisonVariants(
  halos = BODY_HYBRID_HALO_VARIANTS,
  contours = CONTOUR_PRESENTATION_VARIANTS,
): BodyHybridComparisonVariant[] {
  return contours.flatMap((contour) =>
    halos.map((halo) => ({
      id: `${halo.id}-${contour.id}`,
      halo,
      contour,
    })),
  );
}
