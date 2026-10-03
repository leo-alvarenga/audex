import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ConvertPage } from "./pages/ConvertPage";
import { SyncPage } from "./pages/SyncPage";
import { TagPage } from "./pages/TagPage";
import { LyricsPage } from "./pages/LyricsPage";
import { LibraryIndexPage } from "./pages/library/LibraryIndexPage";
import { LibraryQueryPage } from "./pages/library/LibraryQueryPage";
import { LibraryCopyPage } from "./pages/library/LibraryCopyPage";
import { LibraryOrganizePage } from "./pages/library/LibraryOrganizePage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/convert" />} />
          <Route path="/convert" element={<ConvertPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/tag" element={<TagPage />} />
          <Route path="/lyrics" element={<LyricsPage />} />
          <Route path="/library" element={<Navigate to="/library/index" />} />
          <Route path="/library/index" element={<LibraryIndexPage />} />
          <Route path="/library/query" element={<LibraryQueryPage />} />
          <Route path="/library/copy" element={<LibraryCopyPage />} />
          <Route path="/library/organize" element={<LibraryOrganizePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
