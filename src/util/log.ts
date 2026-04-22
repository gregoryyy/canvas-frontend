let _debugEnabled: boolean | undefined = undefined;

function isDebugEnabled(): boolean {
  if (_debugEnabled === undefined) {
    _debugEnabled = new URLSearchParams(window.location.search).get('debug') === 'true';
  }
  return _debugEnabled;
}

export function lg(message: unknown, verbose = false): void {
  if (!isDebugEnabled()) return;
  const stack = new Error().stack!;
  const stackLines = stack.split('\n');
  const callerLine = stackLines[2]!;
  const functionNameMatch = callerLine.match(/at (\S+)/);
  const functionName = functionNameMatch?.[1] ?? 'anonymous function';
  if (verbose) {
    const formattedCallerLine = callerLine.substring(
      callerLine.indexOf('(') + 1,
      callerLine.length - 1,
    );
    console.log(`${message} - ${functionName} - ${formattedCallerLine}`);
  } else {
    console.log(`${message} - ${functionName}()`);
  }
}
