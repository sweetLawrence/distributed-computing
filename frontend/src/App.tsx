import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import {
  AppShell,
  Group,
  Text,
  NavLink,
  ActionIcon,
  Burger
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMantineColorScheme } from '@mantine/core'
import {
  LayoutDashboard,
  ListChecks,
  Terminal,
  Sliders,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Activity,
  BookMarked,
  Sun,
  Moon
} from 'lucide-react'
import Overview from './pages/Overview'
import Milestones from './pages/Milestones'
import MilestoneDetail from './pages/MilestoneDetail'
import Playground from './pages/Playground'
import Control from './pages/Control'
import Failures from './pages/Failures'
import Capstone from './pages/Capstone'
import Reproducibility from './pages/Reproducibility'
import Definitions from './pages/Definitions'
import Story from './pages/Story'
import Cluster from './pages/Cluster'
import { ScrollToTop } from './components/ScrollToTop'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/milestones', label: 'Milestones', icon: ListChecks },
  { to: '/playground', label: 'Playground', icon: Terminal },
  { to: '/control', label: 'Control', icon: Sliders },
  { to: '/failures', label: 'Failures', icon: AlertTriangle },
  { to: '/capstone', label: 'Capstone', icon: BarChart3 },
  { to: '/reproducibility', label: 'Reproducibility', icon: BookOpen },
  { to: '/definitions',     label: 'Definitions',     icon: BookMarked },
  { to: '/story',           label: 'Story',           icon: BookOpen },
  { to: '/cluster',         label: 'Cluster',         icon: Activity }
]

export default function App () {
  const loc = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  const links = NAV.map(n => {
    const Icon = n.icon
    return (
      <NavLink
        key={n.to}
        component={Link}
        to={n.to}
        label={n.label}
        leftSection={<Icon size={18} />}
        active={loc.pathname === n.to}
        onClick={close}
      />
    )
  })

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 220,
        breakpoint: 'sm',
        collapsed: { mobile: !opened }
      }}
      padding={{ base: 'sm', sm: 'md' }}
    >
      <AppShell.Header>
        <Group
          h='100%'
          px={{ base: 'sm', sm: 'md' }}
          justify='space-between'
          wrap='nowrap'
        >
          <Group wrap='nowrap'>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom='sm'
              size='sm'
            />
            <Text fw={700} className='app-title' lineClamp={1}>
              <span className='app-title-short'>Theme 5</span>
              <span className='app-title-long'>
                Theme 5 - Distributed Edge Platform
              </span>
            </Text>
          </Group>
          <ActionIcon
            variant='subtle'
            onClick={() =>
              setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
            }
            aria-label='toggle theme'
          >
            {colorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p='xs'>{links}</AppShell.Navbar>

      <AppShell.Main>
        <ScrollToTop />
        <Routes>
          <Route path='/' element={<Overview />} />
          <Route path='/milestones' element={<Milestones />} />
          <Route path='/milestones/:id' element={<MilestoneDetail />} />
          <Route path='/playground' element={<Playground />} />
          <Route path='/control' element={<Control />} />
          <Route path='/failures' element={<Failures />} />
          <Route path='/capstone' element={<Capstone />} />
          <Route path='/reproducibility' element={<Reproducibility />} />
          <Route path='/definitions'     element={<Definitions />} />
          <Route path='/story'           element={<Story />} />
          <Route path='/cluster'         element={<Cluster />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>

        <footer
          style={{
            marginTop: '3rem',
            paddingTop: '1.25rem',
            paddingBottom: '1rem',
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}
        >
          Made with love by{' '}
          <a
            href="https://github.com/sweetlawrence"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            daddy teresa
          </a>
        </footer>
      </AppShell.Main>
    </AppShell>
  )
}
