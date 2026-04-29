/**
 * A2UI 元素级错误边界
 * 单个组件渲染错误不会导致整页崩溃
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  componentType: string;
  componentId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class A2UIElementErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[A2UI] Rendering error in <${this.props.componentType}> (id=${this.props.componentId}):`,
      error,
      info.componentStack
    );
  }

  override render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
