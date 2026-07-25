import React, { useEffect } from 'react';

interface TitleProps {
    title: string;
}

const Title: React.FC<TitleProps> = ({ title }) => {

    useEffect(() => {
        document.title = title;
    }, [title]);

    return null;
};

export default Title;
