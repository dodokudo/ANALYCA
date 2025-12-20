'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CourseCompletePage() {
  useEffect(() => {
    // Lステップコンバージョンタグを発火
    const img = document.createElement('img');
    img.src = 'https://lstep.app/p/86571/lmRp54';
    img.style.display = 'none';
    img.alt = '';
    document.body.appendChild(img);

    console.log('Lステップ conversion tag fired');

    return () => {
      // クリーンアップ
      if (img.parentNode) {
        img.parentNode.removeChild(img);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Lステップコンバージョンタグ（noscript対応） */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://lstep.app/p/86571/lmRp54" alt="" style={{ display: 'none' }} />
      </noscript>

      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center">
        {/* 成功アイコン */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          お申し込みありがとうございます
        </h1>

        <p className="text-gray-600 mb-6">
          「Threads×AI運用マスター講座」のお申し込みが完了しました。
          <br />
          ご登録いただいたメールアドレスに詳細をお送りしましたので、ご確認ください。
        </p>

        <div className="bg-purple-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-purple-800">
            講座へのアクセス方法は、メールにてご案内いたします。
            <br />
            メールが届かない場合は、迷惑メールフォルダをご確認ください。
          </p>
        </div>

        <Link
          href="/"
          className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
