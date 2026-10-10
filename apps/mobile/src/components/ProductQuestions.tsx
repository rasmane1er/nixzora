import { errorMessage } from '@nixzora/api-client';
import type { QuestionView } from '@nixzora/validation';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, fonts, space, usePalette } from '@/lib/theme';
import { Banner, Button, Card, Field, Row, Text } from './ui';

/** Questions and answers on the product screen (p10-05), like on the website. */
export function ProductQuestions({ slug }: { slug: string }) {
  const c = useT('community');
  const p = usePalette();
  const { shortDate } = useFormatters();
  const { status } = useSession();
  const client = useQueryClient();
  const [asking, setAsking] = useState('');
  const key = ['questions', slug, status];
  const questions = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.catalog.questions(slug, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const ask = useMutation({
    mutationFn: () => api.catalog.ask(slug, asking.trim()),
    onSuccess: () => {
      setAsking('');
      void client.invalidateQueries({ queryKey: key });
    },
  });
  const first = questions.data?.pages[0];
  const items = (questions.data?.pages ?? []).flatMap((page) => page.questions);
  const canAnswer = !!first?.canAnswer;

  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">{c('qaTitle')}</Text>
      {first && !items.length ? <Text muted>{c('noQuestions')}</Text> : null}
      {items.map((question) => (
        <QuestionItem
          key={question.id}
          question={question}
          canAnswer={canAnswer}
          date={shortDate}
          onAnswered={() => void client.invalidateQueries({ queryKey: key })}
          line={p.line}
        />
      ))}
      {questions.hasNextPage ? (
        <Button
          title={c('moreQuestions')}
          tone="secondary"
          loading={questions.isFetchingNextPage}
          onPress={() => questions.fetchNextPage()}
        />
      ) : null}
      {status === 'signedIn' ? (
        <View style={{ gap: space.sm }}>
          <Field
            label={c('askTitle')}
            placeholder={c('askPlaceholder')}
            value={asking}
            onChangeText={setAsking}
            multiline
            maxLength={500}
          />
          {ask.error ? <Banner tone="error">{errorMessage(ask.error)}</Banner> : null}
          {ask.isSuccess ? <Banner tone="ok">{c('asked')}</Banner> : null}
          <Button
            title={c('askButton')}
            tone="secondary"
            loading={ask.isPending}
            disabled={asking.trim().length < 10}
            onPress={() => ask.mutate()}
          />
        </View>
      ) : (
        <Button title={c('askSignIn')} tone="ghost" onPress={() => router.push('/sign-in')} />
      )}
    </Card>
  );
}

function QuestionItem({
  question,
  canAnswer,
  date,
  onAnswered,
  line,
}: {
  question: QuestionView;
  canAnswer: boolean;
  date: (iso: string) => string;
  onAnswered: () => void;
  line: string;
}) {
  const c = useT('community');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const answer = useMutation({
    mutationFn: () => api.catalog.answer(question.id, text.trim()),
    onSuccess: () => {
      setText('');
      setOpen(false);
      onAnswered();
    },
  });
  return (
    <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: line, paddingTop: space.sm }}>
      <Text style={{ fontFamily: fonts.bodyMedium }}>Q: {question.body}</Text>
      <Text variant="small" muted>
        {c('askedBy', { author: question.author, date: date(question.createdAt) })}
      </Text>
      {question.answers.length ? (
        question.answers.map((a) => (
          <View key={a.id} style={{ paddingLeft: space.md, gap: 2 }}>
            <Text>A: {a.body}</Text>
            <Row style={{ gap: space.xs, alignItems: 'center' }}>
              <Text
                variant="small"
                style={{
                  fontFamily: fonts.bodyBold,
                  color: a.role === 'SELLER' ? brand.signalStrong : undefined,
                }}
              >
                {c(`role_${a.role}`)}
              </Text>
              <Text variant="small" muted>
                {c('answerBy', { author: a.author, date: date(a.createdAt) })}
              </Text>
            </Row>
          </View>
        ))
      ) : (
        <Text variant="small" muted>
          {c('noAnswersYet')}
        </Text>
      )}
      {canAnswer ? (
        open ? (
          <View style={{ gap: space.xs }}>
            <Field
              label={c('answerButton')}
              placeholder={c('answerPlaceholder')}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            {answer.error ? <Banner tone="error">{errorMessage(answer.error)}</Banner> : null}
            <Button
              title={c('postAnswer')}
              loading={answer.isPending}
              disabled={text.trim().length < 2}
              onPress={() => answer.mutate()}
            />
          </View>
        ) : (
          <Button title={c('answerButton')} tone="ghost" onPress={() => setOpen(true)} />
        )
      ) : null}
    </View>
  );
}
