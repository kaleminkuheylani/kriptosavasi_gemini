/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Layout from './components/Layout';
import Markets from './components/Markets';
import Kripto from './components/Market';
import News from './components/News';
import Doviz from './components/Doviz';
import Altin from './components/Altin';
import Borsa from './components/Borsa';

export default function App() {
  const [activeTab, setActiveTab] = useState('markets');
  const [searchQuery, setSearchQuery] = useState('');

  const renderContent = () => {
    switch (activeTab) {
      case 'markets':
        return <Markets searchQuery={searchQuery} />;
      case 'kripto':
        return <Kripto searchQuery={searchQuery} />;
      case 'doviz':
        return <Doviz searchQuery={searchQuery} />;
      case 'altin':
        return <Altin searchQuery={searchQuery} />;
      case 'borsa':
        return <Borsa searchQuery={searchQuery} />;
      case 'news':
        return <News searchQuery={searchQuery} />;
      default:
        return <Markets searchQuery={searchQuery} />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      searchQuery={searchQuery} 
      setSearchQuery={setSearchQuery}
    >
      {renderContent()}
    </Layout>
  );
}
