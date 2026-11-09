import { useLayoutEffect, useRef, useState } from "react";
import { useBackLayer } from "../navigation";
import { usePhoneLayout } from "../ux/usePhoneLayout";

export function useOrganizationReview() {
  const phone = usePhoneLayout(),
    [reviewing, setReviewing] = useState(false);
  const review = useRef<HTMLElement>(null),
    position = useRef(0);
  const openReview = () => {
    position.current = document.querySelector(".modal-body")?.scrollTop ?? 0;
    setReviewing(true);
  };
  const closeReview = () => {
    const body = review.current?.closest(".modal-body");
    setReviewing(false);
    requestAnimationFrame(() => {
      if (!body?.isConnected) return;
      body.scrollTop = position.current;
      body
        ?.querySelector<HTMLElement>("[data-review-selection]")
        ?.focus({ preventScroll: true });
    });
  };
  useBackLayer(phone && reviewing, closeReview);
  useLayoutEffect(() => {
    if (!phone || !reviewing || !review.current) return;
    const body = review.current.closest(".modal-body");
    if (body) body.scrollTop = 0;
    review.current
      .querySelector<HTMLElement>("button")
      ?.focus({ preventScroll: true });
  }, [phone, reviewing]);
  return {
    phone,
    reviewing,
    openReview,
    closeReview,
    clearReview: () => setReviewing(false),
    review,
  };
}
