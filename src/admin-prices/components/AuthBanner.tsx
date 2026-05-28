type AuthBannerProps = {
  needsAuth: boolean;
  authHint: string;
  tokenInput: string;
  onTokenChange: (value: string) => void;
  onSaveToken: () => void;
  onClearToken: () => void;
};

export default function AuthBanner({
  needsAuth,
  authHint,
  tokenInput,
  onTokenChange,
  onSaveToken,
  onClearToken,
}: AuthBannerProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">
          Admin access
        </h2>

        {authHint ? (
          <p className="mt-1 text-sm text-slate-500">{authHint}</p>
        ) : null}
      </div>

      {needsAuth ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={tokenInput}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="Paste ADMIN_TOKEN"
            className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
          />

          <button
            type="button"
            onClick={onSaveToken}
            className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Save token
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClearToken}
          className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
        >
          Clear token
        </button>
      )}
    </section>
  );
}