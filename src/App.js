import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import { db } from "./firebase";

const CURRENT_LIST = "currentList";
const HISTORY = "history";

function App() {
  const [currentList, setCurrentList] = useState([]);
  const [history, setHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [shake, setShake] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch(console.error);
      } else {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const listQuery = query(
      collection(db, CURRENT_LIST),
      orderBy("addedAt", "asc")
    );

    const historyQuery = query(
      collection(db, HISTORY),
      orderBy("lastUsed", "desc")
    );

    const unsubList = onSnapshot(listQuery, (snapshot) => {
      setCurrentList(
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => {
      unsubList();
      unsubHistory();
    };
  }, [authReady]);

  const addToList = useCallback(async (item) => {
    if (item.trim() === '') return;

    const normalized = item.trim().toLowerCase();

    const existingInList = currentList.find(
      i => i.text.toLowerCase() === normalized
    );

    if (existingInList) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    await addDoc(collection(db, CURRENT_LIST), {
      text: item.trim(),
      addedAt: Date.now()
    });

    const existingHistoryItem = history.find(
      h => h.text.toLowerCase() === normalized
    );

    if (!existingHistoryItem) {
      await addDoc(collection(db, HISTORY), {
        text: item.trim(),
        lastUsed: Date.now()
      });
    } else {
      await updateDoc(doc(db, HISTORY, existingHistoryItem.id), {
        lastUsed: Date.now()
      });
    }

    setInputValue('');
    inputRef.current?.blur();
  }, [currentList, history]);

  const removeFromList = useCallback(async (id) => {
    await deleteDoc(doc(db, CURRENT_LIST, id));
  }, []);

  const removeFromHistory = useCallback(async (id) => {
    await deleteDoc(doc(db, HISTORY, id));
  }, []);

  const addFromHistory = useCallback(async (historyItem) => {
    const existingInList = currentList.find(
      i => i.text.toLowerCase() === historyItem.text.toLowerCase()
    );
    if (existingInList) return;

    await addDoc(collection(db, CURRENT_LIST), {
      text: historyItem.text,
      addedAt: Date.now()
    });

    await updateDoc(doc(db, HISTORY, historyItem.id), {
      lastUsed: Date.now()
    });
  }, [currentList]);

  const handleSubmit = (e) => {
    e.preventDefault();
    addToList(inputValue);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <h1 className="text-4xl font-bold text-center text-indigo-900 mb-8">
          Malvern Shopping List
        </h1>

        {/* Current Shopping List */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 transition-all duration-300 hover:shadow-xl">          
          {currentList.length === 0 ? (
            <p className="text-gray-400 text-center py-8 animate-pulse">We probably need toilet paper</p>
          ) : (
            <ul className="flex flex-wrap gap-2 mb-4">
              {currentList.map((item, index) => (
                <li
                  key={item.id}
                  className="relative bg-indigo-50 rounded-lg px-4 py-3 pr-10 transition-all duration-200 hover:bg-indigo-100 hover:scale-105 hover:shadow-sm inline-flex items-center animate-slideIn select-none touch-callout-none"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="text-gray-800 text-base whitespace-nowrap">{item.text}</span>
                  <button
                    onClick={() => removeFromList(item.id)}
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-all duration-200 hover:scale-110 text-lg"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add New Item Form */}
          <form onSubmit={handleSubmit} className="mt-4">
            <div className={`relative ${shake ? 'animate-shake' : ''}`}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Add new..."
                className="w-full px-4 py-3 pr-12 border-2 border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-indigo-600 hover:text-indigo-800 hover:scale-110 transition-all duration-200 text-2xl font-bold"
                aria-label="Add item"
              >
                +
              </button>
            </div>
          </form>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">History</h2>
          
          {history.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No history yet</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {history.map((item, index) => (
                <li
                  key={item.id}
                  className="relative bg-gray-50 rounded-lg px-4 py-3 pr-10 cursor-pointer transition-all duration-200 hover:bg-indigo-50 hover:shadow-md hover:scale-105 inline-flex items-center animate-slideIn select-none touch-callout-none"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => addFromHistory(item)}
                >
                  <span className="text-gray-700 text-base whitespace-nowrap">{item.text}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.id);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-all duration-200 hover:scale-110 text-lg"
                    aria-label="Remove from history"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;