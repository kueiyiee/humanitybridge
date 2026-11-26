import React from 'react';
import { BrandLogo } from './BrandLogo';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hb-public-shell min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#071324] p-6">
          <div className="hb-panel max-w-md w-full rounded-xl p-6 text-center space-y-3">
            <BrandLogo className="mx-auto h-[48px] w-[144px]" />
            <h1 className="font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
