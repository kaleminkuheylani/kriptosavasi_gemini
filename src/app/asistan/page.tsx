'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Check, ChevronLeft, Image as ImageIcon, Loader2, Send, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  pendingActions?: PendingAction[];
  suggestedQuestions?: string[];
  timestamp: Date;
}

interface CurrentUser {
  id: string;
  rumuz: string;
}

interface AgentResponse {
  success: boolean;
  response?: string;
  messages?: string[];
  toolsUsed?: string[];
  pendingActions?: PendingAction[];
  suggestedQuestions?: string[];
  requiresAuth?: boolean;
  error?: string;
}

const TOOL_CATEGORIES = [
  {
    id: 'snapshot',
    label: 'Piyasa Ozeti',
    tools: ['get_crypto_snapshot'],
  },
  {
    id: 'asset',
    label: 'Coin Detay',
    tools: ['get_asset_detail'],
  },
  {
    id: 'txt',
    label: 'TXT Analizi',
    tools: ['read_txt_file'],
  },
  {
    id: 'image',
    label: 'Grafik Gorsel Analizi',
    tools: ['analyze_chart_image'],
  },
];

export default function AssistantPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authStateLoading, setAuthStateLoading] = useState(true);

  const txtInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    new Set(TOOL_CATEGORIES.map((category) => category.id)),
  );

  const enabledTools = useMemo(() => {
    const tools = TOOL_CATEGORIES
      .filter((category) => enabledCategories.has(category.id))
      .flatMap((category) => category.tools);
    return [...new Set(tools)];
  }, [enabledCategories]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      if (data.success && data.user) {
        setCurrentUser({ id: data.user.id, rumuz: data.user.rumuz });
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthStateLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const appendAssistantMessages = useCallback((payload: AgentResponse) => {
    const threadMessages = payload.messages?.length ? payload.messages : payload.response ? [payload.response] : [];
    if (threadMessages.length === 0) return;

    setChatMessages((prev) => {
      const additions = threadMessages.map((content, index) => {
        const isFirst = index === 0;
        const isLast = index === threadMessages.length - 1;
        return {
          role: 'assistant' as const,
          content,
          toolsUsed: isFirst ? payload.toolsUsed : undefined,
          pendingActions: isFirst ? payload.pendingActions : undefined,
          suggestedQuestions: isLast ? payload.suggestedQuestions : undefined,
          timestamp: new Date(),
        };
      });
      return [...prev, ...additions];
    });
  }, []);

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    const userMessage = (overrideMessage ?? chatInput).trim();
    if (!userMessage || chatLoading) return;

    const history = chatMessages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: history,
          enabledTools,
        }),
      });

      const data = (await response.json()) as AgentResponse;

      if (response.status === 401 || data.requiresAuth) {
        setCurrentUser(null);
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Asistani kullanmak icin once giris yapmalisin. Ana sayfadaki giris panelini kullanabilirsin.',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Asistan yaniti alinamadi');
      }

      appendAssistantMessages(data);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [appendAssistantMessages, chatInput, chatLoading, chatMessages, enabledTools]);

  const confirmPendingActions = useCallback(async (actions: PendingAction[], msgIndex: number) => {
    if (actions.length === 0 || chatLoading) return;

    setChatMessages((prev) =>
      prev.map((message, index) => (index === msgIndex ? { ...message, pendingActions: undefined } : message)),
    );
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmActions: actions }),
      });
      const data = (await response.json()) as AgentResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Onayli islemler calistirilamadi');
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response ?? 'Islemler tamamlandi.',
          toolsUsed: data.toolsUsed,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Onayli islem hatasi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading]);

  const cancelPendingActions = useCallback((msgIndex: number) => {
    setChatMessages((prev) =>
      prev.map((message, index) => (index === msgIndex ? { ...message, pendingActions: undefined } : message)),
    );
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'Istek iptal edildi, hicbir degisiklik uygulanmadi.',
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleTxtUpload = useCallback(async (file: File) => {
    if (!file || chatLoading) return;

    const content = await file.text();
    const history = chatMessages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: `TXT yuklendi: ${file.name}`,
        timestamp: new Date(),
      },
    ]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txtContent: content,
          txtFilename: file.name,
          conversationHistory: history,
          enabledTools,
        }),
      });

      const data = (await response.json()) as AgentResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'TXT analizi alinamadi');
      }

      appendAssistantMessages(data);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `TXT analiz hatasi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [appendAssistantMessages, chatLoading, chatMessages, enabledTools]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file || chatLoading) return;

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const history = chatMessages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: `Grafik gorseli yuklendi: ${file.name}`,
        timestamp: new Date(),
      },
    ]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          conversationHistory: history,
          enabledTools,
        }),
      });
      const data = (await response.json()) as AgentResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Gorsel analizi alinamadi');
      }
      appendAssistantMessages(data);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Gorsel analiz hatasi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [appendAssistantMessages, chatLoading, chatMessages, enabledTools]);

  const toggleCategory = (categoryId: string) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="overflow-x-auto">
      <div className="mx-auto w-full min-w-[1400px] max-w-[1880px] px-8 py-8">
        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-6">
          <aside className="sticky top-6 space-y-4 self-start">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="space-y-2">
                <CardTitle className="inline-flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-cyan-400" />
                  Asistan Paneli
                </CardTitle>
                <CardDescription>CoinMarketCap tabanli kripto analiz asistani</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800">
                  <Link href="/">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                {authStateLoading ? (
                  <Badge variant="outline" className="w-full justify-center border-slate-700 text-slate-300">
                    Kullanici kontrol ediliyor...
                  </Badge>
                ) : currentUser ? (
                  <Badge variant="outline" className="w-full justify-center border-emerald-500/30 text-emerald-300">
                    @{currentUser.rumuz}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-full justify-center border-amber-500/30 text-amber-300">
                    Giris gerekli
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hizli Promptlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto w-full justify-start border-slate-700 bg-slate-950 py-2 text-left text-xs"
                  onClick={() => void sendMessage('BTC genel durumunu ozetler misin?')}
                  disabled={chatLoading}
                >
                  BTC genel durum
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto w-full justify-start border-slate-700 bg-slate-950 py-2 text-left text-xs"
                  onClick={() => void sendMessage('ETH ve SOL karsilastir')}
                  disabled={chatLoading}
                >
                  ETH vs SOL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto w-full justify-start border-slate-700 bg-slate-950 py-2 text-left text-xs"
                  onClick={() => void sendMessage('Yuksek riskli coinleri listele')}
                  disabled={chatLoading}
                >
                  Yuksek riskli coinler
                </Button>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div>
                <h1 className="text-2xl font-bold">AI Kripto Asistani</h1>
                <p className="text-sm text-slate-300">
                  Soru-cevap, TXT analizi ve grafik gorsel yorumu tek ekranda.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-900 hover:bg-slate-800"
                onClick={() => setToolSelectorOpen((prev) => !prev)}
              >
                Arac Secimi ({enabledTools.length})
              </Button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle>Asistan Sohbeti</CardTitle>
              <CardDescription>Mesaj gonder, onerilen sorulara tikla, gerekirse onay isteyen islemleri yonet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[68vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Ornek: "BTC icin detayli analiz yap" veya "ETH ve SOL karsilastir".
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.timestamp.getTime()}-${index}`}
                        className={`rounded-lg border p-3 ${
                          message.role === 'user'
                            ? 'ml-auto max-w-[90%] border-cyan-900/40 bg-cyan-950/25'
                            : 'max-w-[95%] border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                        {message.toolsUsed && message.toolsUsed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.toolsUsed.map((tool) => (
                              <Badge key={tool} variant="outline" className="border-slate-700 text-xs text-slate-300">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-slate-400">Onerilen sorular:</p>
                            <div className="flex flex-wrap gap-2">
                              {message.suggestedQuestions.map((question, questionIndex) => (
                                <Button
                                  key={`${questionIndex}-${question}`}
                                  size="sm"
                                  variant="outline"
                                  className="h-auto border-slate-700 py-1 text-left text-xs text-slate-200 hover:bg-slate-800"
                                  onClick={() => void sendMessage(question)}
                                  disabled={chatLoading}
                                >
                                  {question}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {message.pendingActions && message.pendingActions.length > 0 && (
                          <div className="mt-3 rounded-md border border-amber-900/40 bg-amber-950/20 p-3">
                            <p className="text-xs font-semibold text-amber-300">Onay bekleyen islemler</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100">
                              {message.pendingActions.map((action, actionIndex) => (
                                <li key={`${action.tool}-${actionIndex}`}>{action.description}</li>
                              ))}
                            </ul>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-700 hover:bg-emerald-600"
                                onClick={() => void confirmPendingActions(message.pendingActions!, index)}
                                disabled={chatLoading}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Onayla
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
                                onClick={() => cancelPendingActions(index)}
                                disabled={chatLoading}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Iptal
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Asistan yanit hazirliyor...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!currentUser || chatLoading}
                  placeholder={currentUser ? 'Sorunu yazip Enter ile gonderebilirsin...' : 'Asistan icin once giris yap'}
                  className="border-slate-700 bg-slate-950"
                />
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={txtInputRef}
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleTxtUpload(file);
                        event.currentTarget.value = '';
                      }}
                    />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleImageUpload(file);
                        event.currentTarget.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-900 hover:bg-slate-800"
                      onClick={() => txtInputRef.current?.click()}
                      disabled={!currentUser || chatLoading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      TXT
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-900 hover:bg-slate-800"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={!currentUser || chatLoading}
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Grafik
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-900 hover:bg-slate-800"
                      onClick={() => setToolSelectorOpen((prev) => !prev)}
                    >
                      Arac Secimi
                    </Button>
                  </div>

                  <Button
                    onClick={() => void sendMessage()}
                    disabled={!currentUser || chatLoading || !chatInput.trim()}
                    className="bg-cyan-700 hover:bg-cyan-600"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Gonder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle>Arac Kategorileri</CardTitle>
              <CardDescription>Aktif kategoriler `/api/agent` icin enabledTools listesine gonderilir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {toolSelectorOpen ? (
                TOOL_CATEGORIES.map((category) => {
                  const active = enabledCategories.has(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        active
                          ? 'border-cyan-600/40 bg-cyan-950/20 text-cyan-200'
                          : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <p className="font-medium">{category.label}</p>
                      <p className="mt-1 text-xs opacity-80">{category.tools.join(', ')}</p>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400">
                  Arac secimini acmak icin "Arac Secimi" butonuna tikla.
                </p>
              )}

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-300">
                  Bu asistan egitim amaclidir. Yanitlar yatirim tavsiyesi degildir.
                </p>
              </div>
            </CardContent>
          </Card>
            </div>
          </section>
        </div>
      </div>
      </div>
    </main>
  );
}
