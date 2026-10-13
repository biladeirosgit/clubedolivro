// src/App.js

import React from 'react';
import { Routes, Route, HashRouter } from "react-router-dom";
import BookClubPage from './cdl/BookClubPage';
import BookClubStats from './cdl/BookClubStats';
import UserStats from './cdl/UserStats';
import GuessGame from './cdl/GuessGame';
import NavBar from './components/NavBar';
import ScrollToTop from './components/ScrollToTop';
import { bookData } from './cdl/books';
import { clubMembers } from './utils/stats';

const MEMBERS = clubMembers(bookData);

const App = () => {
    return (

        <HashRouter>
            <ScrollToTop />
            <NavBar members={MEMBERS} />
            <Routes>
                <Route path="/" element={<BookClubPage/>} />
                <Route path="/stats" element={<BookClubStats/>} />
                <Route path="/users/:username" element={<UserStats/>} />
                <Route path="/guess" element={<GuessGame/>} />
            </Routes>
        </HashRouter>
    );
}

export default App;
