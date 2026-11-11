import { jsx as _jsx } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: each icon the game uses, wrapped so that only this file knows they come from Tabler.
import { IconArrowBackUp, IconBook2, IconBulb, IconCheck, IconChessBishopFilled, IconChessFilled, IconChessKingFilled, IconChessKnightFilled, IconChessQueenFilled, IconChessRookFilled, IconChevronLeft, IconChevronRight, IconFlag, IconListDetails, IconPalette, IconPlayerSkipForward, IconSettings, IconSwords } from "@tabler/icons-react";
const sized = {
  size: 18,
  stroke: 1.7,
  "aria-hidden": true
};
export const TakeBackIcon = () => _jsx(IconArrowBackUp, {
  ...sized
});
export const StudyIcon = () => _jsx(IconBook2, {
  ...sized
});
export const HintIcon = () => _jsx(IconBulb, {
  ...sized
});
export const CheckMarkIcon = () => _jsx(IconCheck, {
  ...sized
});
export const BackIcon = () => _jsx(IconChevronLeft, {
  ...sized
});
export const NextIcon = () => _jsx(IconChevronRight, {
  ...sized
});
export const ResignIcon = () => _jsx(IconFlag, {
  ...sized
});
export const SkipIcon = () => _jsx(IconPlayerSkipForward, {
  ...sized
});
export const SettingsIcon = () => _jsx(IconSettings, {
  ...sized
});
export const CasualIcon = () => _jsx(IconSwords, {
  ...sized
});
export const ScoresheetIcon = () => _jsx(IconListDetails, {
  ...sized
});
export const StyleIcon = () => _jsx(IconPalette, {
  ...sized
});
const roles = {
  pawn: IconChessFilled,
  knight: IconChessKnightFilled,
  bishop: IconChessBishopFilled,
  rook: IconChessRookFilled,
  queen: IconChessQueenFilled,
  king: IconChessKingFilled
};
export const PieceIcon = ({
  role,
  size = 18
}) => {
  const Icon = roles[role];
  return _jsx(Icon, {
    size: size,
    "aria-hidden": true
  });
};