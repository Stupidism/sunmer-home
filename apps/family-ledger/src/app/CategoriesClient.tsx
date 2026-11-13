"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { allTransactions } from "@/lib/domain/monthly";
import { previewFingerprint } from "@/lib/domain/ui";
import type { CategoryDefinition, ClassificationScheme, LedgerScope } from "@/lib/domain/types";
import { bulkMapSourceLabelAction, createCategoryAction, mergeCategoriesAction, previewBulkMapSourceLabelAction, previewMergeCategoriesAction, previewRenameCategoryAction, previewSplitCategoryAction, renameCategoryAction, splitCategoryAction } from "./actions/classifications";
import { useLedgerSnapshot } from "./LedgerContext";

type Preview = { operation: "rename" | "merge" | "split" | "map"; scheme: ClassificationScheme; sourceCategoryId?: string; sourceLabel?: string; destinationCategoryId?: string; expectedRevision: number; expectedDestinationRevision?: number; scope?: LedgerScope; transactionIds: string[]; affected: Array<{ currency: string; count: number; cents: number }> };
type Draft = { kind: Preview["operation"]; sourceId: string; destinationId: string; mainLabel: string; subLabel: string; scope: LedgerScope; ids: string[] };
type PreviewState = { value: Preview; fingerprint: string };
const EMPTY: Draft = { kind: "rename", sourceId: "", destinationId: "", mainLabel: "", subLabel: "", scope: "household", ids: [] };
const EMPTY_MAPPING = { scope: "household" as LedgerScope, sourceLabel: "", destinationId: "", status: "confirmed" as const };
const SCHEME_LABELS: Record<ClassificationScheme, string> = { GB: "GB统计局八大类+扩展", QS: "QS记账软件", ZFB: "ZFB支付宝风格" };
const OPERATION_LABELS: Record<Preview["operation"], string> = { rename: "重命名", merge: "合并", split: "逐笔拆分", map: "原始标签映射" };
const SCOPE_LABELS: Partial<Record<LedgerScope, string>> = { household: "家庭", company: "公司", agency: "代付", funding: "投入/退回", foreignHousehold: "家庭外币", income: "已识别收入", pendingIncome: "待确认收入", excludedIncome: "明确非收入" };

export default function CategoriesClient() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { snapshot, role, refresh, refreshing, refreshError } = useLedgerSnapshot();
  const [scheme, setScheme] = useState<ClassificationScheme>("GB");
  const [queryReady, setQueryReady] = useState(false);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [message, setMessage] = useState("");
  const [createLabels, setCreateLabels] = useState({ mainLabel: "", subLabel: "" });
  const [mapping, setMapping] = useState<{ scope: LedgerScope; sourceLabel: string; destinationId: string; status: "inferred" | "confirmed" }>(EMPTY_MAPPING);
  const [mapPreview, setMapPreview] = useState<PreviewState | null>(null);
  const [pending, start] = useTransition();
  const snapshotKey = previewFingerprint([snapshot.publishedAt, snapshot.taxonomy]);
  const draftKey = previewFingerprint([snapshotKey, scheme, draft]);
  const mappingKey = previewFingerprint([snapshotKey, scheme, mapping]);
  const draftKeyRef = useRef(draftKey);
  const mappingKeyRef = useRef(mappingKey);
  draftKeyRef.current = draftKey;
  mappingKeyRef.current = mappingKey;
  const rows = useMemo(() => allTransactions(snapshot.payload), [snapshot]);
  const usage = useMemo(() => {
    const result = new Map<string, number>();
    for (const row of rows) { const id = row.classifications[scheme].categoryId; if (id) result.set(id, (result.get(id) ?? 0) + 1); }
    return result;
  }, [rows, scheme]);
  const categories = snapshot.taxonomy.categories.filter((item) => item.scheme === scheme && item.state === "active" && (showAll || usage.has(item.id)) && `${item.mainLabel} ${item.subLabel}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedSource = snapshot.taxonomy.categories.find((item) => item.id === draft.sourceId);
  const eligibleRows = rows.filter((row) => row.scope === draft.scope && row.classifications[scheme].categoryId === draft.sourceId);
  const changeDraft = (patch: Partial<Draft>) => { setDraft((value) => ({ ...value, ...patch })); setPreview(null); setMessage(""); };
  const clearDrafts = () => { setDraft(EMPTY); setPreview(null); setMapping(EMPTY_MAPPING); setMapPreview(null); setMessage(""); };
  const selectScheme = (value: ClassificationScheme) => { if (value !== scheme) { setScheme(value); clearDrafts(); } };

  useEffect(() => {
    if (searchParamsKey !== window.location.search.slice(1)) return;
    const value = new URLSearchParams(searchParamsKey).get("scheme");
    const next = value === "QS" || value === "ZFB" ? value : "GB";
    if (next !== scheme) { setScheme(next); clearDrafts(); }
    setQueryReady(true);
  }, [searchParamsKey]);
  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("scheme");
      const next = value === "QS" || value === "ZFB" ? value : "GB";
      if (next !== scheme) { setScheme(next); clearDrafts(); }
      setQueryReady(true);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [scheme]);
  useEffect(() => {
    if (!queryReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("scheme") === scheme) return;
    params.set("scheme", scheme);
    window.history.replaceState(window.history.state, "", `/categories?${params.toString()}`);
  }, [queryReady, scheme]);
  const priorSnapshotKey = useRef(snapshotKey);
  useEffect(() => {
    if (priorSnapshotKey.current === snapshotKey) return;
    priorSnapshotKey.current = snapshotKey;
    clearDrafts();
  }, [snapshotKey]);
  const runPreview = () => start(async () => {
    if (!selectedSource) return setMessage("请选择来源分类。");
    const fingerprint = draftKey;
    const result = draft.kind === "rename"
      ? await previewRenameCategoryAction({ categoryId: selectedSource.id, expectedRevision: selectedSource.revision })
      : draft.kind === "merge"
        ? await previewMergeCategoriesAction({ sourceCategoryId: selectedSource.id, destinationCategoryId: draft.destinationId, expectedRevision: selectedSource.revision })
        : await previewSplitCategoryAction({ sourceCategoryId: selectedSource.id, destinationCategoryId: draft.destinationId, scope: draft.scope, transactionIds: draft.ids, expectedRevision: selectedSource.revision });
    if (fingerprint !== draftKeyRef.current) return;
    if (result.ok) setPreview({ value: result.value as Preview, fingerprint }); else setMessage(friendly(result.error));
  });
  const commit = () => preview && start(async () => {
    if (preview.fingerprint !== draftKeyRef.current) { setPreview(null); return setMessage("当前选择已变化，请重新预览。"); }
    const captured = preview.value;
    const result = captured.operation === "rename"
      ? await renameCategoryAction({ preview: captured, mainLabel: draft.mainLabel, subLabel: draft.subLabel })
      : captured.operation === "merge" ? await mergeCategoriesAction(captured)
      : await splitCategoryAction({ preview: captured, evidence: { source: "category management UI" } });
    if (!result.ok) { setPreview(null); return setMessage(`${friendly(result.error)} 请刷新快照后重新预览。`); }
    await refresh(); setPreview(null); setDraft(EMPTY); setMessage("分类变更已保存。");
  });
  const create = () => start(async () => {
    setPreview(null);
    const result = await createCategoryAction({ scheme, ...createLabels });
    if (!result.ok) return setMessage(friendly(result.error));
    await refresh(); setCreateLabels({ mainLabel: "", subLabel: "" }); setMessage("新分类已创建。");
  });
  const changeMapping = (patch: Partial<typeof mapping>) => { setMapping((value) => ({ ...value, ...patch })); setMapPreview(null); setMessage(""); };
  const previewMapping = () => start(async () => {
    const fingerprint = mappingKey;
    const revision = snapshot.taxonomy.schemes.find((item) => item.code === scheme)?.revision;
    if (!revision) return setMessage("当前体系缺少修订信息，请刷新快照。");
    const result = await previewBulkMapSourceLabelAction({ scheme, scope: mapping.scope, sourceLabel: mapping.sourceLabel, destinationCategoryId: mapping.destinationId, expectedRevision: revision });
    if (fingerprint !== mappingKeyRef.current) return;
    if (result.ok) setMapPreview({ value: result.value as Preview, fingerprint }); else setMessage(friendly(result.error));
  });
  const commitMapping = () => mapPreview && start(async () => {
    if (mapPreview.fingerprint !== mappingKeyRef.current) { setMapPreview(null); return setMessage("当前映射已变化，请重新预览。"); }
    const result = await bulkMapSourceLabelAction({ preview: mapPreview.value, status: mapping.status, evidence: { source: "category management UI" } });
    if (!result.ok) { setMapPreview(null); return setMessage(`${friendly(result.error)} 请刷新快照后重新预览。`); }
    await refresh(); setMapPreview(null); setMapping(EMPTY_MAPPING); setMessage("原始标签映射已保存。");
  });
  return <div className="category-page">
    <header className="page-head"><div><p className="eyebrow">Family Ledger</p><h1>分类管理</h1><p>重命名、合并和逐笔拆分只改变分类，不改变日期、金额、币种或账本范围。</p></div></header>
    <div className="scheme-tabs">{(["GB", "QS", "ZFB"] as const).map((item) => <button key={item} disabled={pending} className={scheme === item ? "active" : ""} onClick={() => selectScheme(item)}>{SCHEME_LABELS[item]}</button>)}</div>
    <section className="category-toolbar"><input aria-label="搜索分类" placeholder="搜索主类或子类" value={search} onChange={(e) => setSearch(e.target.value)} /><label><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> 显示未使用分类</label><button onClick={() => void refresh()} disabled={refreshing || pending}>{refreshing ? "刷新中…" : "刷新快照"}</button></section>
    {refreshError ? <p role="alert" className="notice">{refreshError}</p> : null}
    <div className="category-grid">
      <section className="card"><h2>分类目录</h2><p className="muted">当前使用 {categories.filter((c) => usage.has(c.id)).length} 项；体系修订 {snapshot.taxonomy.schemes.find((s) => s.code === scheme)?.revision ?? "—"}</p>
        <div className="category-list">{categories.map((item) => <button key={item.id} disabled={pending} className={draft.sourceId === item.id ? "active" : ""} onClick={() => changeDraft({ sourceId: item.id, mainLabel: item.mainLabel, subLabel: item.subLabel, ids: [] })}><strong>{item.mainLabel}</strong><span>{item.subLabel} · {usage.get(item.id) ?? 0} 笔</span></button>)}</div>
      </section>
      <section className="card"><h2>变更分类</h2>{role !== "admin" ? <p className="notice">当前为只读角色，不能提交分类变更。</p> : <>
        <fieldset disabled={pending}><legend>新建分类</legend><label>主类<input value={createLabels.mainLabel} onChange={(e) => { setCreateLabels((v) => ({ ...v, mainLabel: e.target.value })); setPreview(null); }} /></label><label>子类<input value={createLabels.subLabel} onChange={(e) => { setCreateLabels((v) => ({ ...v, subLabel: e.target.value })); setPreview(null); }} /></label><button onClick={create} disabled={!createLabels.mainLabel.trim() || !createLabels.subLabel.trim()}>创建</button></fieldset>
        <label>操作<select disabled={pending} value={draft.kind} onChange={(e) => changeDraft({ kind: e.target.value as Draft["kind"], ids: [] })}><option value="rename">重命名</option><option value="merge">合并</option><option value="split">逐笔拆分</option></select></label>
        {draft.kind === "rename" ? <><label>主类<input disabled={pending} value={draft.mainLabel} onChange={(e) => changeDraft({ mainLabel: e.target.value })} /></label><label>子类<input disabled={pending} value={draft.subLabel} onChange={(e) => changeDraft({ subLabel: e.target.value })} /></label></> : <label>目标分类<select disabled={pending} value={draft.destinationId} onChange={(e) => changeDraft({ destinationId: e.target.value })}><option value="">请选择</option>{snapshot.taxonomy.categories.filter((c) => c.scheme === scheme && c.state === "active" && c.id !== draft.sourceId).map((c) => <option key={c.id} value={c.id}>{c.mainLabel} / {c.subLabel}</option>)}</select></label>}
        {draft.kind === "split" ? <><label>账本范围<select disabled={pending} value={draft.scope} onChange={(e) => changeDraft({ scope: e.target.value as LedgerScope, ids: [] })}>{[...new Set(rows.map((r) => r.scope))].map((scope) => <option key={scope} value={scope}>{scopeLabel(scope)}</option>)}</select></label><div className="transaction-checks">{eligibleRows.map((row) => <label key={row.id}><input disabled={pending} type="checkbox" checked={draft.ids.includes(row.id)} onChange={(e) => changeDraft({ ids: e.target.checked ? [...draft.ids, row.id] : draft.ids.filter((id) => id !== row.id) })} />{row.date} · {row.merchant || row.sourceCategory} · {money(row.cents, row.currency)}</label>)}</div></> : null}
        <button onClick={runPreview} disabled={pending || !draft.sourceId || (draft.kind !== "rename" && !draft.destinationId) || (draft.kind === "split" && !draft.ids.length)}>预览影响</button>
        {preview ? <ConfirmationPanel preview={preview.value} source={selectedSource ? `${selectedSource.mainLabel} / ${selectedSource.subLabel}` : "—"} destination={draft.kind === "rename" ? `${draft.mainLabel} / ${draft.subLabel}` : categoryPath(snapshot.taxonomy.categories, draft.destinationId)} onCommit={commit} pending={pending} /> : null}</>}
        {message ? <p role="status">{message}</p> : null}
      </section>
    </div>
    <section className="card"><h2>原始标签映射</h2>{role === "admin" ? <fieldset disabled={pending}><legend>批量确认 / 重新分配（逐笔覆盖不会被改变）</legend><label>范围<select value={mapping.scope} onChange={(e) => changeMapping({ scope: e.target.value as LedgerScope })}>{[...new Set(rows.map((r) => r.scope))].map((scope) => <option key={scope} value={scope}>{scopeLabel(scope)}</option>)}</select></label><label>原始标签<input list="source-labels" value={mapping.sourceLabel} onChange={(e) => changeMapping({ sourceLabel: e.target.value })} /><datalist id="source-labels">{[...new Set(rows.filter((r) => r.scope === mapping.scope).map((r) => r.sourceCategory))].sort().map((label) => <option key={label} value={label} />)}</datalist></label><label>目标分类<select value={mapping.destinationId} onChange={(e) => changeMapping({ destinationId: e.target.value })}><option value="">请选择</option>{snapshot.taxonomy.categories.filter((c) => c.scheme === scheme && c.state === "active").map((c) => <option key={c.id} value={c.id}>{c.mainLabel} / {c.subLabel}</option>)}</select></label><label>审核状态<select value={mapping.status} onChange={(e) => changeMapping({ status: e.target.value as "inferred" | "confirmed" })}><option value="confirmed">已确认</option><option value="inferred">待核</option></select></label><button onClick={previewMapping} disabled={!mapping.sourceLabel.trim() || !mapping.destinationId}>预览映射影响</button>{mapPreview ? <ConfirmationPanel preview={mapPreview.value} source={`原始标签：${mapping.sourceLabel}`} destination={categoryPath(snapshot.taxonomy.categories, mapping.destinationId)} onCommit={commitMapping} pending={pending} /> : null}</fieldset> : null}<div className="table-wrap"><table><thead><tr><th>范围</th><th>原始标签</th><th>目标分类</th><th>状态</th><th>操作</th></tr></thead><tbody>{snapshot.taxonomy.rules.filter((r) => r.scheme === scheme).map((rule) => { const target = snapshot.taxonomy.categories.find((c) => c.id === rule.categoryId); return <tr key={rule.id}><td>{scopeLabel(rule.scope)}</td><td>{rule.sourceLabel}</td><td>{target ? `${target.mainLabel} / ${target.subLabel}` : "已失效"}</td><td>{rule.status === "confirmed" ? "已确认" : "待核"}</td><td><button disabled={pending || !target} onClick={() => changeMapping({ scope: rule.scope, sourceLabel: rule.sourceLabel, destinationId: rule.categoryId, status: rule.status })}>载入编辑</button></td></tr>; })}</tbody></table></div></section>
    <section className="card"><h2>分类审计记录</h2><div className="table-wrap"><table><thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>原值</th><th>新值</th></tr></thead><tbody>{(snapshot.taxonomy.audit ?? []).filter((item) => item.scheme === scheme).map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</td><td>{item.actor}</td><td>{item.operation}</td><td>{compact(item.before)}</td><td>{compact(item.after)}</td></tr>)}</tbody></table></div></section>
    <footer className="muted">已发布：{new Date(snapshot.publishedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</footer>
  </div>;
}

function ConfirmationPanel({ preview, source, destination, onCommit, pending }: { preview: Preview; source: string; destination: string; onCommit: () => void; pending: boolean }) {
  return <div className="confirm-panel">
    <h3>确认变更</h3>
    <p>操作：{OPERATION_LABELS[preview.operation]}</p>
    <p>范围：{preview.scope ? scopeLabel(preview.scope) : "全部账本范围"}</p>
    <p>来源：{source}</p>
    <p>目标：{destination}</p>
    <p>合计：{preview.affected.reduce((total, item) => total + item.count, 0)} 笔</p>
    {preview.affected.map((item) => <p key={item.currency}>{item.currency}：{item.count} 笔，{money(item.cents, item.currency)}</p>)}
    <button onClick={onCommit} disabled={pending}>确认提交</button>
  </div>;
}

function categoryPath(categories: CategoryDefinition[], id: string) {
  const category = categories.find((item) => item.id === id);
  return category ? `${category.mainLabel} / ${category.subLabel}` : "—";
}

function scopeLabel(scope: LedgerScope) { return SCOPE_LABELS[scope] ?? scope; }

function money(cents: number, currency: string) { return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(cents / 100); }
function friendly(error: string) { if (/revision|stale/i.test(error)) return "分类已被其他操作更新，当前预览已失效。"; if (/authorized/i.test(error)) return "当前账号没有修改权限。"; if (/already exists|duplicate/i.test(error)) return "同一体系中已存在相同路径。"; return "操作未完成，请检查选择后重试。"; }
function compact(value: unknown) { if (value === null || value === undefined) return "—"; const text = typeof value === "string" ? value : JSON.stringify(value); return text.length > 100 ? `${text.slice(0, 100)}…` : text; }
