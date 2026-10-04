import Link from 'next/link'

import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// TODO：工作室登記完成後，營運者名稱改為登記名稱
const CONTACT_EMAIL = 'myainovelcom@gmail.com'
const EFFECTIVE_DATE = '2026/10/04'

const COLLECTED: [string, string, string][] = [
  ['LINE 帳號資料', 'LINE 使用者識別碼、顯示名稱、大頭貼網址', '你同意 LINE 登入授權後由 LINE 提供（授權範圍僅 profile、openid，不含 Email）'],
  ['聯絡 Email', '用於寄送到期與扣款提醒', '若你於帳號設定自行填寫（非必填）'],
  ['學習資料', '單字本與其語言、單字、答案、描述、標籤、測驗與作答紀錄、正確率、熟練度與複習排程、每日任務、連續天數、成就、語言設定', '你使用本服務時產生或匯入的 Excel'],
  ['改善建議', '你送出的文字內容', '你於「改善建議」頁面填寫'],
  ['帳號狀態', '註冊時間、試用與早鳥期限、帳號狀態、暫停與刪除時間', '系統自動產生'],
  ['技術紀錄', 'IP 位址、瀏覽器類型、存取時間等伺服器日誌', '主機與資料庫服務自動產生'],
]

const PROVIDERS: [string, string, string, string][] = [
  ['LY Corporation（LINE Login）', '登入身分驗證', 'LINE 帳號資料', '依 LINE 政策'],
  ['Supabase', '資料庫', '第二節所有資料', '新加坡'],
  ['Vercel', '網站主機與伺服器運算', '技術紀錄；處理請求時經手的資料', '新加坡（運算）、全球節點（傳輸）'],
  ['Cloudflare', '網域名稱解析（DNS）', '網域查詢紀錄', '全球節點'],
]

const RETENTION: [string, string][] = [
  ['試用中、付費中', '完整保存'],
  ['已暫停（試用或早鳥到期未付費、扣款寬限期滿）', '自暫停日起保留 3 個月，期間可匯出單字；期滿後清除'],
  ['你主動刪除帳號（任何狀態皆可）', '立即清除，無法復原'],
]

const RIGHTS: [string, string][] = [
  ['查詢、閱覽、製給複製本', '登入後直接查看；於帳號設定「匯出全部單字本」下載 Excel；其他資料以 Email 申請'],
  ['補充或更正', '單字資料可直接編輯；LINE 名稱與大頭貼於下次登入時自動更新'],
  ['停止蒐集、處理或利用', '以 Email 申請，或刪除帳號'],
  ['刪除', '於帳號設定「刪除帳號」立即執行（範圍見第六節）'],
]

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-semibold text-ink whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-dashed border-line align-top">
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-4 ${i === 0 ? 'text-ink font-medium min-w-[9em]' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif font-bold text-ink text-lg">{title}</h2>
      {children}
    </section>
  )
}

export default async function PrivacyPage() {
  const user = await getSessionUser()
  const loggedIn = Boolean(user && user.status !== 'cancelled')

  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-8 py-16 min-h-[60vh]">
        <Link
          href={loggedIn ? '/app' : '/'}
          className="text-sm text-ink-soft hover:text-ink mb-6 inline-block"
        >
          {loggedIn ? '← 返回 App' : '← 返回首頁'}
        </Link>
        <h1 className="font-serif font-black text-3xl mb-2">隱私權政策</h1>
        <p className="font-mono text-xs text-ink-soft mb-8">生效日期：{EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-sm text-ink-soft leading-relaxed">
          <Section title="一、前言與適用範圍">
            <p>
              字力測驗（以下稱「本服務」）依中華民國「個人資料保護法」蒐集、處理與利用你的個人資料。本政策適用於
              zilitest.com 及其子網域提供的所有功能。
            </p>
            <p>使用本服務或以 LINE 登入，即表示你已閱讀並同意本政策。若不同意，請勿登入或使用本服務。</p>
          </Section>

          <Section title="二、我們蒐集的個人資料">
            <p>
              本服務只蒐集提供功能所需的資料，<b className="text-ink">不會取得或儲存你的 LINE 密碼</b>。
            </p>
            <Table head={['類別', '內容', '來源']} rows={COLLECTED} />
            <p>本服務目前不蒐集付款資料，也未使用廣告或流量分析工具。</p>
          </Section>

          <Section title="三、蒐集目的與利用方式">
            <p>你的資料只用於提供與改善本服務，不用於廣告。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b className="text-ink">身分識別與登入</b>：以 LINE 使用者識別碼建立帳號、維持登入狀態，並在畫面顯示你的名稱與大頭貼
              </li>
              <li>
                <b className="text-ink">提供學習功能</b>：保存單字與作答紀錄，計算熟練度、安排每日任務，統計掌握字數、等級、連續天數與成就
              </li>
              <li>
                <b className="text-ink">帳號管理</b>：試用、早鳥與付費狀態的判斷、到期暫停與資料保留、500 字上限計算
              </li>
              <li>
                <b className="text-ink">通知</b>：登入時顯示到期提醒；若你填寫 Email，寄送到期與扣款提醒
              </li>
              <li>
                <b className="text-ink">改善服務</b>：閱讀改善建議，以及利用伺服器日誌排除故障、維護資安
              </li>
            </ul>
            <p>利用期間為帳號存續期間及第六節所述的保存期間；利用對象為本服務及第四節列出的服務提供者。</p>
          </Section>

          <Section title="四、第三方服務與資料傳輸">
            <p>
              本服務<b className="text-ink">不會出售、出租或交換</b>
              你的個人資料。為提供服務，資料會由下列服務提供者代為處理，其中部分位於台灣以外。
            </p>
            <Table head={['服務提供者', '用途', '處理的資料', '資料所在地']} rows={PROVIDERS} />
            <p>除上述情形，只有在法律要求、司法或主管機關依法調取時，才會提供你的資料。</p>
          </Section>

          <Section title="五、Cookie">
            <p>本服務只使用維持登入所需的 Cookie，不使用廣告或跨網站追蹤 Cookie。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b className="text-ink">登入 Cookie</b>：儲存你的帳號編號，設定為 httpOnly（網頁程式無法讀取），有效期 30 天，登出或刪除帳號時立即清除
              </li>
              <li>
                <b className="text-ink">LINE 登入流程</b>：登入過程中暫存防偽造驗證碼，完成後即失效
              </li>
            </ul>
            <p>若你在瀏覽器停用 Cookie，將無法登入本服務。</p>
          </Section>

          <Section title="六、資料保存期間與刪除">
            <p>帳號使用期間保存你的資料；帳號暫停滿 3 個月或你主動刪除帳號時，資料即被清除。</p>
            <Table head={['帳號情況', '資料處理']} rows={RETENTION} />
            <p>
              <b className="text-ink">清除的資料</b>
              ：單字本、單字、標籤、學習與作答紀錄、熟練度、每日任務、成就、連續天數、語言設定、改善建議與 Email。
            </p>
            <p>
              <b className="text-ink">清除後仍保留的資料</b>
              ：LINE 使用者識別碼、顯示名稱、大頭貼網址、帳號狀態與刪除時間。保留目的僅為識別同一 LINE
              帳號再次登入，並依服務條款視為全新帳號、不再發放早鳥資格。
            </p>
            <p>成就、等級與連續天數不在資料匯出範圍內。伺服器日誌依各服務提供者的保存規則定期刪除。</p>
          </Section>

          <Section title="七、你的權利">
            <p>依個人資料保護法第 3 條，你可以對自己的個人資料行使下列權利。</p>
            <Table head={['權利', '行使方式']} rows={RIGHTS} />
            <p>
              以 Email 提出的申請，我們會在確認身分後於 15 日內回覆；必要時得延長 15
              日，並以書面告知理由。你也可以自由選擇不提供資料，但本服務需要 LINE 登入才能使用。
            </p>
          </Section>

          <Section title="八、資料安全">
            <p>我們以下列措施保護你的資料，但網路傳輸無法保證絕對安全。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>全站使用 HTTPS 加密傳輸</li>
              <li>資料庫不開放瀏覽器直接存取，所有讀寫經由伺服器驗證登入身分，且只能存取你自己的資料</li>
              <li>資料庫管理金鑰僅存放於伺服器端</li>
              <li>登入 Cookie 設定為 httpOnly，降低被惡意程式竊取的風險</li>
            </ul>
            <p>若發生個人資料外洩、遭竊取或竄改，我們會在查明後以適當方式通知你。</p>
          </Section>

          <Section title="九、未成年人">
            <p>
              未滿 18 歲者，應經法定代理人閱讀並同意本政策後再使用本服務。若法定代理人發現未成年人未經同意使用，可聯絡我們刪除其資料。
            </p>
          </Section>

          <Section title="十、政策修訂與聯絡方式">
            <p>
              本政策修訂後會公告於本頁並更新生效日期；涉及蒐集項目、目的或第三方服務的重大變更，會於登入時另行通知。例如未來推出
              AI 抽字或線上付款功能前，會先更新本政策。
            </p>
            <p>
              對本政策有任何問題，或要行使第七節的權利，請來信：<a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline">
                {CONTACT_EMAIL}
              </a>。
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
