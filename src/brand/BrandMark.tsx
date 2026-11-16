import mark from "./mark.svg?raw";
const themedMark = mark.replace(/#[0-9a-f]{6}/gi, "currentColor");
export default function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="brand-symbol"
      dangerouslySetInnerHTML={{ __html: themedMark }}
    />
  );
}
