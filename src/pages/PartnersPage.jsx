// src/pages/PartnersPage.jsx
import React from "react";
import { LS, save } from "../lib/storage.js";
import { uid } from "../lib/uid.js";

/* ====== 유틸 ====== */
const onlyDigits = (s = "") => (s + "").replace(/\D/g, "");
const withCommas = (s = "") => {
  const d = onlyDigits(s);
  return d ? Number(d).toLocaleString() : "";
};

/* ====== 상단 토스트 (OutLaterListPage와 동일 스타일) ====== */
function Toast({ open, type = "success", message = "" }) {
  const color =
    type === "success" ? "bg-emerald-600" : type === "warning" ? "bg-amber-500" : "bg-rose-600";
  return (
    <div
      className={[
        "fixed left-1/2 -translate-x-1/2 z-[100] rounded-xl shadow-lg text-white px-4 py-2",
        color,
        "transition-all duration-300 ease-out",
        open ? "top-4 opacity-100 translate-y-0" : "-top-10 opacity-0 -translate-y-4",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

/* ========= 공통 섹션(완전 숨김 + 부드러운 펼침) ========= */
function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <span className="text-base font-semibold">{title}</span>
        <span className={`transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}>
          ▽
        </span>
      </button>

      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          open ? "max-h-[1200px] p-3 pt-0" : "max-h-0 p-0"
        }`}
      >
        <div className={open ? "" : "pointer-events-none select-none"}>{children}</div>
      </div>
    </div>
  );
}

/* ========= 상세 보기 모달 ========= */
function PartnerDetailModal({ partner, onClose }) {
  if (!partner) return null;
  const fee = partner.fee || {};
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">거래처 상세</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              ✕
            </button>
          </div>

          {/* 스크롤 영역 */}
          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-500">유형</div>
                <div className="font-medium">{partner.kind === "buy" ? "매입처" : "매출처"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">과세구분</div>
                <div className="font-medium">{partner.taxType === "tax" ? "과세" : "면세"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">거래처명</div>
                <div className="font-medium">{partner.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">상호명</div>
                <div className="font-medium">{partner.alias}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">반품기한(일)</div>
                <div className="font-medium">{partner.returnDays ?? "-"}</div>
              </div>
            </div>

            {partner.kind === "sell" && (
              <Section title="수수료 설정" defaultOpen>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600 mr-2">플랫폼</span>
                    <span className="font-medium">
                      {fee.platform === "online"
                        ? "온라인 판매"
                        : fee.platform === "kream"
                        ? "크림"
                        : fee.platform === "poison"
                        ? "포이즌"
                        : "-"}
                    </span>
                  </div>
                  {["online", "kream"].includes(fee.platform) && (
                    <div className="text-sm">
                      <span className="text-gray-600 mr-2">VAT</span>
                      <span className="font-medium">
                        {fee.vatMode === "separate" ? "VAT 별도" : "VAT 포함"}
                      </span>
                    </div>
                  )}
                  {fee.platform === "online" && (
                    <div className="text-sm">
                      <span className="text-gray-600 mr-2">수수료(%)</span>
                      <span className="font-medium">{fee.onlinePercent || "-"}</span>
                    </div>
                  )}
                  {fee.platform === "kream" && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 mr-2">수수료(%)</span>
                        <span className="font-medium">{fee.kreamPercent || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 mr-2">고정 수수료(원)</span>
                        <span className="font-medium">
                          {fee.kreamFixed ? Number(fee.kreamFixed).toLocaleString() : "-"}
                        </span>
                      </div>
                    </div>
                  )}
                  {fee.platform === "poison" && (
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600 mr-2">구분</span>
                        <span className="font-medium">
                          {fee.poisonCategory === "goods" ? "잡화" : "의류/신발"}
                        </span>
                      </div>
                      {fee.poisonCategory !== "goods" ? (
                        <div className="text-sky-600 font-semibold">
                          기본 수수료 15,000원 / 150,000원 이상시 10%차감 / 450,000원 이상부터는 일괄 45,000원 차감
                        </div>
                      ) : (
                        <div className="text-sky-600 font-semibold">
                          기본 수수료 18,000원 / 129,000원 이상시 14%차감 / 322,000원 이상부터는 일괄 45,000원 차감
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section title="거래처 정보">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">주소</div>
                  <div className="font-medium">{partner.addr || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">연락처</div>
                  <div className="font-medium">{partner.tel || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">사업자번호</div>
                  <div className="font-medium">{partner.bizno || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">홈페이지</div>
                  <div className="font-medium">{partner.homepage || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">이메일</div>
                  <div className="font-medium">{partner.email || "-"}</div>
                </div>
              </div>
            </Section>

            <Section title="결제 정보">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">은행명</div>
                  <div className="font-medium">{partner.bank || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">예금주</div>
                  <div className="font-medium">{partner.owner || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">계좌번호</div>
                  <div className="font-medium">{partner.account || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">결제주기</div>
                  <div className="font-medium">{partner.payCycle || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">결제일</div>
                  <div className="font-medium">{partner.payDay || "-"}</div>
                </div>
              </div>
            </Section>
          </div>

          <div className="p-4 border-t flex items-center justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= 추가/수정 모달 ========= */
function PartnerModal({ onClose, onSave, initial, notify }) {
  const isEdit = !!initial;
  const [kind, setKind] = React.useState(initial?.kind || "buy"); // 'buy'|'sell'
  const [name, setName] = React.useState(initial?.name || "");
  const [alias, setAlias] = React.useState(initial?.alias || "");
  const [taxType, setTaxType] = React.useState(initial?.taxType || "tax"); // 'tax'|'taxfree'
  const [returnDays, setReturnDays] = React.useState(initial?.returnDays || "");

  // optional
  const [addr, setAddr] = React.useState(initial?.addr || "");
  const [tel, setTel] = React.useState(initial?.tel || "");
  const [bizno, setBizno] = React.useState(initial?.bizno || "");
  const [homepage, setHomepage] = React.useState(initial?.homepage || "");
  const [email, setEmail] = React.useState(initial?.email || "");
  const [bank, setBank] = React.useState(initial?.bank || "");
  const [owner, setOwner] = React.useState(initial?.owner || "");
  const [account, setAccount] = React.useState(initial?.account || "");
  const [payCycle, setPayCycle] = React.useState(initial?.payCycle || "");
  const [payDay, setPayDay] = React.useState(initial?.payDay || "");

  // 수수료(매출처 전용)
  const initFee = initial?.fee || {};
  const [platform, setPlatform] = React.useState(initFee.platform || "online"); // 'online'|'kream'|'poison'
  const [vatMode, setVatMode] = React.useState(initFee.vatMode || "separate"); // 'separate'|'included'
  const [onlinePercent, setOnlinePercent] = React.useState(initFee.onlinePercent || "");
  const [kreamPercent, setKreamPercent] = React.useState(initFee.kreamPercent || "");
  const [kreamFixed, setKreamFixed] = React.useState(
    initFee.kreamFixed ? withCommas(String(initFee.kreamFixed)) : ""
  );
  const [poisonCategory, setPoisonCategory] = React.useState(initFee.poisonCategory || "clothing_shoes"); // 'clothing_shoes'|'goods'

  // 포이즌 선택 시 과세구분 자동 면세 고정
  React.useEffect(() => {
    if (kind === "sell" && platform === "poison") setTaxType("taxfree");
  }, [kind, platform]);

  // 유효성: 필수 입력칸
  const invalid = {
    name: !name.trim(),
    alias: !alias.trim(),
    returnDays: kind === "buy" && !(Number(onlyDigits(returnDays)) > 0),
    onlinePercent: kind === "sell" && platform === "online" && !(Number(onlyDigits(onlinePercent)) > 0),
    kreamPercent: kind === "sell" && platform === "kream" && !(Number(onlyDigits(kreamPercent)) > 0),
    kreamFixed: kind === "sell" && platform === "kream" && !(Number(onlyDigits(kreamFixed)) > 0),
  };

  const saveData = () => {
    // 필수 체크
    if (invalid.name || invalid.alias) {
      notify?.("warning", "필수 항목(거래처명/상호명)을 입력해주세요.");
      return;
    }
    if (kind === "buy" && invalid.returnDays) {
      notify?.("warning", "매입처의 반품기한(숫자)을 입력해주세요.");
      return;
    }
    if (kind === "sell" && platform === "online" && invalid.onlinePercent) {
      notify?.("warning", "온라인 판매 수수료(%)를 숫자로 입력해주세요.");
      return;
    }
    if (kind === "sell" && platform === "kream" && (invalid.kreamPercent || invalid.kreamFixed)) {
      notify?.("warning", "크림 수수료(%)와 고정 수수료(원)를 숫자로 입력해주세요.");
      return;
    }

    const payload = {
      kind,
      name: name.trim(),
      alias: alias.trim(),
      // 포이즌(매출처)일 때 저장 시에도 면세 고정
      taxType: kind === "sell" && platform === "poison" ? "taxfree" : taxType,
      returnDays: kind === "buy" ? Number(onlyDigits(returnDays) || 0) : undefined,
      addr,
      tel: onlyDigits(tel), // 숫자만
      bizno: onlyDigits(bizno), // 숫자만
      homepage,
      email,
      bank,
      owner,
      account: onlyDigits(account), // 숫자만
      payCycle: onlyDigits(payCycle), // 숫자만
      payDay: onlyDigits(payDay), // 숫자만
    };

    if (kind === "sell") {
      payload.fee = {
        platform,
        ...(platform !== "poison" ? { vatMode } : {}),
        ...(platform === "online" ? { onlinePercent: onlyDigits(onlinePercent) } : {}),
        ...(platform === "kream"
          ? {
              kreamPercent: onlyDigits(kreamPercent),
              kreamFixed: Number(onlyDigits(kreamFixed) || 0),
            }
          : {}),
        ...(platform === "poison" ? { poisonCategory } : {}),
      };
    } else {
      payload.fee = null;
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{isEdit ? "거래처 수정" : "거래처 추가"}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              ✕
            </button>
          </div>

          {/* 스크롤 영역 */}
          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
            {/* 입출구분 */}
            <div>
              <div className="text-sm text-gray-600 mb-2">입출구분</div>
              {isEdit ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-gray-50">
                  <span className="text-gray-500">고정</span>
                  <span className="font-medium">{initial?.kind === "buy" ? "매입처" : "매출처"}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setKind("buy")}
                    className={`px-3 py-2 rounded-xl border ${
                      kind === "buy" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                    }`}
                  >
                    매입처
                  </button>
                  <button
                    onClick={() => setKind("sell")}
                    className={`px-3 py-2 rounded-xl border ${
                      kind === "sell" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                    }`}
                  >
                    매출처
                  </button>
                </div>
              )}
            </div>

            {/* 매출처 UI */}
            {kind === "sell" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">거래처명</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 플랫폼"
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.name ? "border-rose-400 bg-rose-50" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">상호명</label>
                    <input
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="예: 크림"
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.alias ? "border-rose-400 bg-rose-50" : ""
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600">과세구분</label>
                  <select
                    value={platform === "poison" ? "taxfree" : taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${
                      platform === "poison" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                    }`}
                    disabled={platform === "poison"}
                  >
                    <option value="tax">과세</option>
                    <option value="taxfree">면세</option>
                  </select>
                  {platform === "poison" && (
                    <div className="text-xs text-red-600 mt-1">
                      *포이즌 플랫폼은 면세로 고정됩니다. (수수료값도 고정)
                    </div>
                  )}
                </div>

                <div className="border rounded-xl p-3">
                  <div className="text-base font-semibold mb-2">수수료 설정</div>
                  <div className="mb-2">
                    <div className="text-sm text-gray-600 mb-1">플랫폼 선택</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPlatform("online")}
                        className={`px-3 py-2 rounded-xl border ${
                          platform === "online" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                        }`}
                      >
                        온라인 판매
                      </button>
                      <button
                        onClick={() => setPlatform("kream")}
                        className={`px-3 py-2 rounded-xl border ${
                          platform === "kream" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                        }`}
                      >
                        크림
                      </button>
                      <button
                        onClick={() => setPlatform("poison")}
                        className={`px-3 py-2 rounded-xl border ${
                          platform === "poison" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                        }`}
                      >
                        포이즌
                      </button>
                    </div>
                  </div>

                  {platform === "online" && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">수수료에 대한 VAT</div>
                        <div className="flex gap-3 text-sm">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="vatMode"
                              checked={vatMode === "separate"}
                              onChange={() => setVatMode("separate")}
                            />
                            VAT 별도
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="vatMode"
                              checked={vatMode === "included"}
                              onChange={() => setVatMode("included")}
                            />
                            VAT 포함
                          </label>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          별도: 설정된 수수료 금액에 부가세 10%가 추가됩니다.
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">온라인 판매 수수료(%)</label>
                        <input
                          value={onlinePercent}
                          onChange={(e) => setOnlinePercent(onlyDigits(e.target.value))}
                          className={`w-full border rounded-xl px-3 py-2 ${
                            invalid.onlinePercent ? "border-rose-400 bg-rose-50" : ""
                          }`}
                          inputMode="numeric"
                          placeholder="예: 10"
                        />
                      </div>
                    </div>
                  )}

                  {platform === "kream" && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">수수료에 대한 VAT</div>
                        <div className="flex gap-3 text-sm">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="vatMode"
                              checked={vatMode === "separate"}
                              onChange={() => setVatMode("separate")}
                            />
                            VAT 별도
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="vatMode"
                              checked={vatMode === "included"}
                              onChange={() => setVatMode("included")}
                            />
                            VAT 포함
                          </label>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          별도: 설정된 수수료 금액에 부가세 10%가 추가됩니다.
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-gray-600">수수료(%)</label>
                          <input
                            value={kreamPercent}
                            onChange={(e) => setKreamPercent(onlyDigits(e.target.value))}
                            className={`w-full border rounded-xl px-3 py-2 ${
                              invalid.kreamPercent ? "border-rose-400 bg-rose-50" : ""
                            }`}
                            inputMode="numeric"
                            placeholder="예: 9"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">고정 수수료(원)</label>
                          <input
                            value={kreamFixed}
                            onChange={(e) => setKreamFixed(withCommas(e.target.value))}
                            className={`w-full border rounded-xl px-3 py-2 ${
                              invalid.kreamFixed ? "border-rose-400 bg-rose-50" : ""
                            }`}
                            inputMode="numeric"
                            placeholder="예: 3,300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {platform === "poison" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-600">구분</label>
                        <select
                          value={poisonCategory}
                          onChange={(e) => setPoisonCategory(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2"
                        >
                          <option value="clothing_shoes">의류/신발</option>
                          <option value="goods">잡화</option>
                        </select>
                      </div>
                      {poisonCategory === "clothing_shoes" ? (
                        <div className="text-sky-600 font-semibold">
                          기본 수수료 15,000원 / 150,000원 이상시 10%차감 / 450,000원 이상부터는 일괄 45,000원 차감
                        </div>
                      ) : (
                        <div className="text-sky-600 font-semibold">
                          기본 수수료 18,000원 / 129,000원 이상시 14%차감 / 322,000원 이상부터는 일괄 45,000원 차감
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 매입처 UI */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">거래처명</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 현대 아울렛 송도점"
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.name ? "border-rose-400 bg-rose-50" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">상호명</label>
                    <input
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="예: 나이키"
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.alias ? "border-rose-400 bg-rose-50" : ""
                      }`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">과세구분</label>
                    <select
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    >
                      <option value="tax">과세</option>
                      <option value="taxfree">면세</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">반품기한(일)</label>
                    <input
                      value={returnDays}
                      onChange={(e) => setReturnDays(onlyDigits(e.target.value))}
                      placeholder="예: 14"
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.returnDays ? "border-rose-400 bg-rose-50" : ""
                      }`}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 공통: 거래처 정보 / 결제 정보 */}
            <Section title="거래처 정보">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">주소</label>
                  <input
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="예: 서울시 ..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">연락처</label>
                    <input
                      value={tel}
                      onChange={(e) => setTel(onlyDigits(e.target.value))}
                      placeholder="예: 01012345678"
                      className="w-full border rounded-xl px-3 py-2"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">사업자번호</label>
                    <input
                      value={bizno}
                      onChange={(e) => setBizno(onlyDigits(e.target.value))}
                      placeholder="예: 1234567890"
                      className="w-full border rounded-xl px-3 py-2"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">홈페이지</label>
                    <input
                      value={homepage}
                      onChange={(e) => setHomepage(e.target.value)}
                      placeholder="예: https://"
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">이메일</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="예: name@example.com"
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="결제 정보">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">은행명</label>
                    <input
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">예금주</label>
                    <input
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">계좌번호</label>
                  <input
                    value={account}
                    onChange={(e) => setAccount(onlyDigits(e.target.value))}
                    className="w-full border rounded-xl px-3 py-2"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">결제주기</label>
                    <input
                      value={payCycle}
                      onChange={(e) => setPayCycle(onlyDigits(e.target.value))}
                      className="w-full border rounded-xl px-3 py-2"
                      inputMode="numeric"
                      placeholder="숫자만"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">결제일</label>
                    <input
                      value={payDay}
                      onChange={(e) => setPayDay(onlyDigits(e.target.value))}
                      className="w-full border rounded-xl px-3 py-2"
                      inputMode="numeric"
                      placeholder="숫자만"
                    />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">
              취소
            </button>
            <button onClick={saveData} className="px-4 py-2 rounded-xl bg-sky-500 text-white">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= 목록/검색 + 행 클릭 상세 + 수정/삭제 + 토스트 ========= */
export default function PartnersPage({ partners, setPartners }) {
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);
  const [detailTarget, setDetailTarget] = React.useState(null);

  // 토스트
  const [toast, setToast] = React.useState({ open: false, type: "success", message: "" });
  const toastTimer = React.useRef(null);
  const showToast = (type, message, ms = 3000) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast({ open: true, type, message });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
  };

  React.useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const filtered = React.useMemo(() => {
    let list = partners;
    if (typeFilter !== "all") list = list.filter((p) => p.kind === typeFilter);
    const t = q.trim().toLowerCase();
    if (t)
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(t) ||
          (p.alias || "").toLowerCase().includes(t) ||
          (p.addr || "").toLowerCase().includes(t) ||
          (p.email || "").toLowerCase().includes(t) ||
          (p.tel || "").toLowerCase().includes(t)
      );
    return list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [partners, q, typeFilter]);

  const onDelete = (id) => {
    if (!confirm("이 거래처를 삭제할까요?")) return;
    const next = partners.filter((p) => p.id !== id);
    setPartners(next);
    save(LS.PARTNERS, next);
    showToast("success", "삭제되었습니다.");
  };

  const onCreate = (data) => {
    const next = [...partners, { id: uid(), ...data }];
    setPartners(next);
    save(LS.PARTNERS, next);
    setShowAddModal(false);
    showToast("success", "저장되었습니다.");
  };

  const onUpdate = (id, data) => {
    const next = partners.map((p) => (p.id === id ? { ...p, ...data } : p));
    setPartners(next);
    save(LS.PARTNERS, next);
    setEditTarget(null);
    showToast("success", "저장되었습니다.");
  };

  return (
    <div className="space-y-3 relative">
      {/* 토스트 */}
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      {/* 검색/필터/추가 */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="거래처명 / 상호명 / 주소 / 연락처 / 이메일"
          className="flex-1 border rounded-xl px-3 py-2 bg-white"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-xl px-3 py-2 bg-white"
        >
          <option value="all">유형 전체</option>
          <option value="buy">매입처</option>
          <option value="sell">매출처</option>
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
        >
          + 거래처 추가
        </button>
      </div>

      {/* 목록: 가운데 정렬, 과세구분만 오른쪽 정렬 */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-center text-gray-600 border-b">
              <th className="py-2 w-24">유형</th>
              <th className="py-2 w-48">거래처명</th>
              <th className="py-2 w-48">상호명</th>
              <th className="py-2 w-56">주소</th>
              <th className="py-2 w-40">연락처</th>
              <th className="py-2 w-56">이메일</th>
              <th className="py-2 w-24 text-right pr-2">과세구분</th>
              <th className="py-2 w-24 text-right pr-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="py-4 text-gray-500 text-center">
                  등록된 거래처가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.kind === "buy" ? "매입처" : "매출처"}
                </td>
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.name}
                </td>
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.alias}
                </td>
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.addr || "-"}
                </td>
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.tel || "-"}
                </td>
                <td className="py-2 text-center cursor-pointer" onClick={() => setDetailTarget(p)}>
                  {p.email || "-"}
                </td>
                <td
                  className="py-2 text-right pr-2 cursor-pointer"
                  onClick={() => setDetailTarget(p)}
                >
                  {p.taxType === "tax" ? "과세" : "면세"}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2 justify-end pr-1">
                    <button
                      title="수정"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(p);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      ✎
                    </button>
                    <button
                      title="삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모달들 */}
      {showAddModal && (
        <PartnerModal onClose={() => setShowAddModal(false)} onSave={onCreate} notify={showToast} />
      )}

      {editTarget && (
        <PartnerModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(data) => onUpdate(editTarget.id, data)}
          notify={showToast}
        />
      )}

      {detailTarget && (
        <PartnerDetailModal partner={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}
