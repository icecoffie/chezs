import { jsx as _jsx } from "react/jsx-runtime";
const token = space => space === "none" ? "0" : `var(--space-${space})`;
export const Stack = ({
  as: Tag = "div",
  direction = "column",
  gap = "none",
  pad = "none",
  align,
  justify,
  wrap,
  grow,
  className,
  children,
  ...rest
}) => _jsx(Tag, {
  className: className,
  style: {
    display: "flex",
    flexDirection: direction,
    gap: token(gap),
    padding: token(pad),
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : undefined,
    flexGrow: grow ? 1 : undefined,
    minWidth: 0
  },
  ...rest,
  children: children
});