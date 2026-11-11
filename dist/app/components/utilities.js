import { jsx as _jsx } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the error boundary and the status boundary that together give every view one loading and one failure state.
import { Component, Suspense } from "react";
export class ErrorBoundary extends Component {
  state = {
    error: null
  };
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  componentDidCatch(error, info) {
    this.props.onError(error, info);
  }
  render() {
    const {
      error
    } = this.state;
    return error ? this.props.fallback(error, () => this.setState({
      error: null
    })) : this.props.children;
  }
}
export const StatusBoundary = ({
  loading,
  fallback,
  onError,
  children
}) => _jsx(ErrorBoundary, {
  fallback: fallback,
  onError: onError,
  children: _jsx(Suspense, {
    fallback: loading,
    children: children
  })
});