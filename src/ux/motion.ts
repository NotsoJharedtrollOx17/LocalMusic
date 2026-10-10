export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
export function animateCover(from: DOMRect, to: DOMRect, src: string) {
  if (reducedMotion() || !from.width || !to.width) return () => {};
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.className = "cover-flight";
  Object.assign(image.style, {
    left: to.left + "px",
    top: to.top + "px",
    width: to.width + "px",
    height: to.height + "px",
  });
  document.body.append(image);
  const animation = image.animate(
    [
      {
        transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`,
        borderRadius: "7px",
      },
      { transform: "none", borderRadius: "7px" },
    ],
    { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" },
  );
  const remove = () => {
    animation.cancel();
    image.remove();
  };
  animation.finished.then(remove, remove);
  return remove;
}
